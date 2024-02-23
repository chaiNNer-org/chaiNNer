from __future__ import annotations

import os

import cv2
import numpy as np
import torch
from appdirs import user_data_dir
from facexlib.utils.face_restoration_helper import FaceRestoreHelper
from sanic.log import logger
from spandrel import ImageModelDescriptor
from torchvision.transforms.functional import normalize as tv_normalize

from api import NodeContext
from nodes.groups import Condition, if_group
from nodes.impl.image_utils import to_uint8
from nodes.impl.pytorch.utils import np2tensor, safe_cuda_cache_empty, tensor2np
from nodes.properties.inputs import FaceModelInput, ImageInput, NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from ...settings import PyTorchSettings, get_settings
from .. import restoration_group


def denormalize(img: np.ndarray):
    img = to_uint8(img, normalized=True)
    _, _, c = get_h_w_c(img)
    if c == 4:
        img = img[:, :, :3]
    elif c == 1:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    return img


@torch.inference_mode()
def upscale(
    img: np.ndarray,
    background_img: np.ndarray | None,
    face_helper: FaceRestoreHelper,
    face_model: ImageModelDescriptor,
    weight: float,
    exec_options: PyTorchSettings,
    device: torch.device,
):
    face_helper.clean_all()

    face_helper.read_image(img)
    # get face landmarks for each face
    face_helper.get_face_landmarks_5(only_center_face=False, eye_dist_threshold=5)
    # eye_dist_threshold=5: skip faces whose eye distance is smaller than 5 pixels
    # TODO: even with eye_dist_threshold, it will still introduce wrong detections and restorations.
    # align and warp each face
    face_helper.align_warp_face()

    should_use_fp16 = exec_options.use_fp16 and face_model.supports_half
    if should_use_fp16:
        face_model.model.half()
    else:
        face_model.model.float()

    # face restoration
    for cropped_face in face_helper.cropped_faces:
        # prepare data
        cropped_face_t = np2tensor(
            cropped_face, bgr2rgb=True, change_range=True, add_batch=False
        )
        tv_normalize(cropped_face_t, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], inplace=True)
        cropped_face_t = cropped_face_t.unsqueeze(0).to(device)

        try:
            if should_use_fp16:
                cropped_face_t = cropped_face_t.half()
            else:
                cropped_face_t = cropped_face_t.float()
            output = face_model.model(cropped_face_t, return_rgb=False, weight=weight)[
                0
            ]
            # convert to image
            output = (output + 1) / 2
            restored_face = tensor2np(output.squeeze(0), rgb2bgr=True)
        except RuntimeError as error:
            logger.error(f"\t脸部升级推理失败: {error}.")
            restored_face = cropped_face

        restored_face = restored_face.astype("uint8")
        face_helper.add_restored_face(restored_face)

    if background_img is not None:
        # upsample the background
        background_img = denormalize(background_img)

        face_helper.get_inverse_affine(None)
        # paste each restored face to the input image
        restored_img = face_helper.paste_faces_to_input_image(
            upsample_img=background_img
        )
    else:
        face_helper.get_inverse_affine(None)
        restored_img = face_helper.paste_faces_to_input_image()
    del face_helper
    safe_cuda_cache_empty()

    restored_img = np.clip(restored_img.astype("float32") / 255.0, 0, 1)

    return restored_img


@restoration_group.register(
    schema_id="chainner:pytorch:upscale_face",
    name="人脸放大",
    description=(
        "使用人脸检测使用 PyTorch 人脸超分辨率模型对图像中的人脸进行放大和修复。"
        "目前支持 GFPGAN，RestoreFormer 和 CodeFormer。"
    ),
    icon="PyTorch",
    inputs=[
        ImageInput().with_id(1),
        FaceModelInput("模型").with_id(0),
        ImageInput("放大后的背景").with_id(2).make_optional(),
        NumberInput(
            label="输出比例", default=8, minimum=1, maximum=8, unit="x"
        ).with_id(3),
        if_group(Condition.type(0, 'PyTorchModel { arch: "CodeFormer" }'))(
            SliderInput(
                label="权重",
                default=0.7,
                minimum=0.0,
                maximum=1.0,
                controls_step=0.1,
                slider_step=0.1,
                precision=1,
            )
        ),
    ],
    outputs=[
        ImageOutput(
            "图像",
            image_type="""
                Image {
                    width: Input3 * Input1.width,
                    height: Input3 * Input1.height,
                }
                """,
            channels=3,
        )
    ],
    limited_to_8bpc=True,
    node_context=True,
)
def upscale_face_node(
    context: NodeContext,
    img: np.ndarray,
    face_model: ImageModelDescriptor,
    background_img: np.ndarray | None,
    scale: int,
    weight: float,
) -> np.ndarray:
    face_helper = None
    try:
        img = denormalize(img)

        exec_options = get_settings(context)
        device = exec_options.device

        with torch.no_grad():
            appdata_path = user_data_dir(roaming=True)
            path_str = "chaiNNer/python/gfpgan/weights"
            download_path = os.path.join(appdata_path, path_str)

            # initialize face helper
            face_helper = FaceRestoreHelper(
                upscale_factor=scale,
                face_size=512,
                crop_ratio=(1, 1),
                det_model="retinaface_resnet50",
                save_ext="png",
                use_parse=True,
                device=device,
                model_rootpath=download_path,
            )

            result = upscale(
                img,
                background_img,
                face_helper,
                face_model,
                weight,
                exec_options,
                device,
            )

            return result

    except Exception as e:
        logger.error(f"脸部升级失败: {e}")
        face_helper = None
        del face_helper
        safe_cuda_cache_empty()
        raise RuntimeError("无法运行 Face Upscale。") from e
