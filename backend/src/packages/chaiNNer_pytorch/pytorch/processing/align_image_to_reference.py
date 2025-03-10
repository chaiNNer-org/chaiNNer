# Original Rife Frame Interpolation by hzwer
# https://github.com/megvii-research/ECCV2022-RIFE
# https://github.com/hzwer/Practical-RIFE

# Original XFeat Accelerated Features for Lightweight Image Matching
# https://www.verlab.dcc.ufmg.br/descriptors/xfeat_cvpr24/
# https://github.com/verlab/accelerated_features

# Modifications for image alignment by pifroggi
# Node currently matches vs_align 3.0.0
# https://github.com/pifroggi/vs_align
from __future__ import annotations

import zipfile
from enum import Enum
from pathlib import Path

import cv2
import numpy as np
import requests
import torch
from torch.nn import functional

from api import NodeContext
from nodes.impl.pytorch.rife.IFNet_HDv3_v4_14_align import IFNet
from nodes.impl.pytorch.utils import np2tensor, safe_cuda_cache_empty, tensor2np
from nodes.impl.pytorch.xfeat.xfeat_align import XFeat, gen_grid
from nodes.properties.inputs import BoolInput, EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput

from ...settings import PyTorchSettings, get_settings
from .. import processing_group


class PrecisionMode(Enum):
    FIFTY_PERCENT = 1
    ONE_HUNDRED_PERCENT = 2
    TWO_HUNDRED_PERCENT = 3
    FOUR_HUNDRED_PERCENT = 4


def calculate_padding(height: int, width: int, modulus: int) -> tuple[int, int]:
    pad_height = (modulus - height % modulus) % modulus
    pad_width = (modulus - width % modulus) % modulus
    return pad_height, pad_width


def download_model(
    download_url: str,
    model_dir: Path,
    model_file: str,
    zip_inner_path: str | None = None,
) -> Path:
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / model_file

    # if the file already exists locally, return it
    if model_path.exists():
        return model_path

    # download the file
    try:
        response = requests.get(download_url)
        response.raise_for_status()
    except requests.RequestException as e:
        raise RuntimeError(
            f"Failed to download the file from {download_url}. Error: {e}"
        ) from e

    # if zip_inner_path then unzip
    if zip_inner_path is not None:
        zip_path = model_dir / "model_temp.zip"
        with open(zip_path, "wb") as f:
            f.write(response.content)

        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zipped_file_path = f"{zip_inner_path}/{model_file}"
            zip_ref.extract(zipped_file_path, model_dir)

        extracted_file_path = model_dir / zipped_file_path
        if extracted_file_path != model_path:
            extracted_file_path.rename(model_path)

        # clean up
        zip_path.unlink(missing_ok=True)
        subfolder = model_dir / zip_inner_path
        try:
            subfolder.rmdir()  # remove empty subfolder if possible
        except OSError:
            pass
    else:
        with open(model_path, "wb") as f:
            f.write(response.content)

    return model_path


def align_images(
    context: NodeContext,
    fclip: np.ndarray,
    ref: np.ndarray,
    fmask: np.ndarray | None,
    precision: PrecisionMode,
    lq_input: bool,
    wide_search: bool,
    exec_options: PyTorchSettings,
) -> np.ndarray:
    # settings
    device = exec_options.device
    fp16 = exec_options.use_fp16
    precision = precision.value
    blur = 2 if lq_input else 0
    smooth = 11 if lq_input else 0

    # scales
    s1 = (16, 8, 4, 2)  # needs mod64 pad
    s2 = (8, 4, 2, 1)  # needs mod32 pad
    s3 = (4, 2, 1, 0.5)  # needs mod16 pad
    s4 = (2, 1, 0.5, 0.25)  # needs mod8  pad

    # initialize rife_align model
    rife_model_path = download_model(
        download_url="https://drive.usercontent.google.com/download?id=1BjuEY7CHZv1wzmwXSQP9ZTj0mLWu_4xy&export=download&authuser=0",
        model_dir=context.storage_dir / "rife_v4.14/weights",
        model_file="flownet.pkl",
        zip_inner_path="train_log",
    )
    state_dict = torch.load(rife_model_path, map_location=device, weights_only=True)
    state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
    rife_align = IFNet().to(device)
    rife_align.load_state_dict(state_dict, strict=False)
    rife_align.eval()
    if fp16:
        rife_align.half()

    # initialize xfeat model
    if wide_search:
        xfeat_model_path = download_model(
            download_url="https://raw.githubusercontent.com/verlab/accelerated_features/e92685f57f8318b18725c5c8c0bd28c7fe188d9a/weights/xfeat.pt",
            model_dir=context.storage_dir / "xfeat/weights",
            model_file="xfeat.pt",
        )
        state_dict = torch.load(
            xfeat_model_path, map_location=device, weights_only=True
        )
        descriptor = XFeat(
            top_k=3000, weights=state_dict, height=480, width=704, device=device
        )
        matcher = XFeat(device=device)
        if fp16:
            descriptor.half()
            matcher.half()

    # convert to tensors
    fclip = np2tensor(fclip, change_range=True).to(device)
    fref = np2tensor(ref, change_range=True).to(device)
    if fmask is not None:
        if fmask.ndim == 3:
            fmask = fmask[:, :, 0]
        fmask = np2tensor(fmask, change_range=True).to(device)

    # convert to fp16 if needed
    if fp16:
        fclip = fclip.half()
        fref = fref.half()

    # align fclip to fref
    with torch.inference_mode():
        # homography alignment with xfeat and cv2
        if wide_search:
            # detect points
            fref = functional.pad(
                fref, (4, 4, 4, 4), mode="replicate"
            )  # pad to reduce border artifacts
            _, _, fref_h, fref_w = fref.shape  # update height and width due to padding
            _, _, fclip_h, fclip_w = fclip.shape
            fclip_points = descriptor.detectAndCompute(fclip)[0]  # compute points
            fref_points = descriptor.detectAndCompute(fref)[0]  # compute points
            kpts1, descs1 = fclip_points["keypoints"], fclip_points["descriptors"]
            kpts2, descs2 = fref_points["keypoints"], fref_points["descriptors"]
            points_found = len(kpts1) > 100 and len(kpts2) > 100

            if points_found:  # only proceed if there are enough points
                # match points between the two images
                idx0, idx1 = matcher.match(descs1, descs2, 0.82)
                match_found = len(idx0) > 50

                if match_found:  # only proceed if there are enough matched points
                    # find homography from matched points with cv2
                    pts1 = kpts1[idx0].cpu().numpy()
                    pts2 = kpts2[idx1].cpu().numpy()
                    homography, _ = cv2.findHomography(
                        pts1,
                        pts2,
                        cv2.USAC_MAGSAC,
                        10.0,
                        maxIters=1000,
                        confidence=0.995,
                    )  # find homography on cpu
                    homography_t = torch.tensor(
                        homography, dtype=torch.float32, device=device
                    )  # send back to gpu
                    homography_t = gen_grid(
                        homography_t, fclip_h, fclip_w, fref_h, fref_w, device
                    )  # generate grid for grid sample
                    if fp16:
                        homography_t = homography_t.half()
                    fclip = functional.grid_sample(
                        fclip,
                        homography_t,
                        mode="bicubic",
                        padding_mode="border",
                        align_corners=True,
                    )  # warp

                    # mask area outside the warped image
                    corners_src = np.float32(
                        [
                            [0, 0],
                            [fclip_w - 1, 0],
                            [fclip_w - 1, fclip_h - 1],
                            [0, fclip_h - 1],
                        ]
                    ).reshape(-1, 1, 2)  # corners of source
                    corners_dst = cv2.perspectiveTransform(
                        corners_src, homography
                    )  # transform corners with homography
                    homography_mask = np.ones(
                        (fref_h, fref_w), dtype=np.float32
                    )  # create full white mask
                    cv2.fillConvexPoly(
                        homography_mask, np.int32(corners_dst), 0.0
                    )  # fill inside corners with black

                    # get bounding box
                    corners = corners_dst.reshape(-1, 2)
                    min_xy = np.floor(corners.min(axis=0)).astype(int)
                    max_xy = np.ceil(corners.max(axis=0)).astype(int)
                    min_x, min_y = np.maximum(min_xy, 0)
                    max_x, max_y = np.minimum(max_xy, [fref_w, fref_h])

                    # avoid cropping to small value
                    if max_x - min_x < 16:
                        min_x, max_x = 0, 16
                    if max_y - min_y < 16:
                        min_y, max_y = 0, 16

                    # convert to tensor and combine homography_mask with fmask if it exists
                    if fmask is not None:
                        homography_mask = torch.from_numpy(homography_mask)[
                            None, None
                        ].to(device)
                        if fmask.shape[2] != fref_h or fmask.shape[3] != fref_w:
                            fmask = functional.interpolate(
                                fmask, size=(fref_h - 8, fref_w - 8), mode="nearest"
                            )  # resize but compensate for pad from earlier
                            fmask = functional.pad(
                                fmask, (4, 4, 4, 4), mode="replicate"
                            )
                        fmask = fmask + homography_mask
                    else:
                        fmask = torch.from_numpy(homography_mask)[None, None].to(device)

                    # crop to bounding box
                    fclip = fclip[:, :, min_y:max_y, min_x:max_x]
                    fref = fref[:, :, min_y:max_y, min_x:max_x]
                    if fmask is not None:
                        fmask = fmask[:, :, min_y:max_y, min_x:max_x]

        # padding for scales
        _, _, fref_h_new, fref_w_new = fref.shape
        if precision in (1, 2):
            p1 = calculate_padding(fref_h_new, fref_w_new, 64)
        if precision > 1:
            p2 = calculate_padding(fref_h_new, fref_w_new, 32)
        if precision > 2:
            p3 = calculate_padding(fref_h_new, fref_w_new, 16)
        if precision > 3:
            p4 = calculate_padding(fref_h_new, fref_w_new, 8)

        # flow based alignment with rife
        with torch.amp.autocast(device.type, enabled=fp16):
            if precision == 1:
                fclip = rife_align(
                    fclip,
                    fref,
                    fmask if fmask is not None else None,
                    s1,
                    p1,
                    blur=blur,
                    smooth=smooth * 3 if smooth > 0 else 11,
                    compensate=True,
                    device=device,
                    fp16=fp16,
                )
            elif precision == 2:
                fclip = rife_align(
                    fclip,
                    fref,
                    fmask if fmask is not None else None,
                    s1,
                    p1,
                    blur=9,
                    smooth=91,
                    compensate=False,
                    device=device,
                    fp16=fp16,
                )
                fclip = rife_align(
                    fclip,
                    fref,
                    fmask if fmask is not None else None,
                    s2,
                    p2,
                    blur=blur,
                    smooth=smooth,
                    compensate=True,
                    device=device,
                    fp16=fp16,
                )
            elif precision == 3:
                fclip = rife_align(
                    fclip,
                    fref,
                    fmask if fmask is not None else None,
                    s2,
                    p2,
                    blur=9,
                    smooth=15,
                    compensate=False,
                    device=device,
                    fp16=fp16,
                )
                fclip = rife_align(
                    fclip,
                    fref,
                    fmask if fmask is not None else None,
                    s3,
                    p3,
                    blur=blur,
                    smooth=smooth,
                    compensate=True,
                    device=device,
                    fp16=fp16,
                )
            elif precision == 4:
                fclip = rife_align(
                    fclip,
                    fref,
                    fmask if fmask is not None else None,
                    s2,
                    p2,
                    blur=9,
                    smooth=15,
                    compensate=False,
                    device=device,
                    fp16=fp16,
                )
                fclip = rife_align(
                    fclip,
                    fref,
                    fmask if fmask is not None else None,
                    s3,
                    p3,
                    blur=2,
                    smooth=7,
                    compensate=False,
                    device=device,
                    fp16=fp16,
                )
                fclip = rife_align(
                    fclip,
                    fref,
                    fmask if fmask is not None else None,
                    s4,
                    p4,
                    blur=blur,
                    smooth=smooth,
                    compensate=True,
                    device=device,
                    fp16=fp16,
                )

        if wide_search:
            if points_found and match_found:
                fclip = functional.pad(
                    fclip,
                    (min_x, fref_w - max_x, min_y, fref_h - max_y),
                    mode="replicate",
                )  # pad what was removed from boundry box crop
            fclip = fclip[
                :, :, 4:-4, 4:-4
            ]  # crop padding used to reduce border artifacts

    # convert back to numpy
    return tensor2np(fclip.squeeze(0).cpu(), change_range=False, imtype=np.float32)


@processing_group.register(
    schema_id="chainner:pytorch:image_align_rife",
    name="Align Image to Reference",
    description=[
        "Aligns and removes distortions by warping an Image towards a Reference Image. Tips for best results:",
        "- Always crop black bars or letterboxes on both images.",
        "- If Image's brightness or colors are vastly different, make Reference Image roughly match.",
    ],
    icon="BsRulers",
    inputs=[
        ImageInput("Image", channels=3),
        ImageInput("Reference Image", channels=3),
        ImageInput("Mask")
        .make_optional()
        .with_docs(
            "Optionally use a black & white mask to exclude areas in white from warping, like a watermark or text that is only on one image. Masked areas will instead be warped like the surroundings.",
            "The masked areas correspond to the same areas on the Reference Image.",
            hint=True,
        ),
        EnumInput(
            PrecisionMode,
            label="Precision",
            default=PrecisionMode.TWO_HUNDRED_PERCENT,
            option_labels={
                PrecisionMode.FIFTY_PERCENT: "50%",
                PrecisionMode.ONE_HUNDRED_PERCENT: "100%",
                PrecisionMode.TWO_HUNDRED_PERCENT: "200%",
                PrecisionMode.FOUR_HUNDRED_PERCENT: "400%",
            },
        ).with_docs(
            "Speed/Quality tradeoff with higher meaning finer alignment up to a subpixel level. Higher is slower and requires more VRAM.",
            "100% or 200% works great in most cases. 400% is only needed if both input images are very high quality.",
            hint=True,
        ),
        BoolInput("Low Quality Input", default=False).with_docs(
            "Enables better handling for low-quality input images. When turned on general shapes are prioritized over high-frequency details like noise, grain, or compression artifacts by averaging the warping across a small area.",
            "Also fixes an issue sometimes noticeable in Anime images, where lines can get slightly thicker/thinner due to warping.",
            hint=True,
        ),
        BoolInput("Wide Search", default=False).with_docs(
            "Enables a larger search radius at the cost of some speed. When turned on completely different crops like 4:3 and 16:9, shearing, and rotations up to 45° can be aligned.",
            "Recommended if the misalignment is larger than about 20 pixel.",
            hint=True,
        ),
    ],
    outputs=[ImageOutput(shape_as=1).with_docs("Returns the aligned image.")],
    node_context=True,
)
def align_image_to_reference_node(
    context: NodeContext,
    fclip: np.ndarray,
    ref: np.ndarray,
    fmask: np.ndarray | None,
    precision: PrecisionMode,
    lq_input: bool,
    wide_search: bool,
) -> np.ndarray:
    exec_options = get_settings(context)
    context.add_cleanup(
        safe_cuda_cache_empty,
        after="node" if exec_options.force_cache_wipe else "chain",
    )

    return align_images(
        context,
        fclip,
        ref,
        fmask,
        precision,
        lq_input,
        wide_search,
        exec_options,
    )
