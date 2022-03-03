# pylint: skip-file
# From https://github.com/victorca25/iNNfer/blob/main/utils/utils.py
import functools
import sys
import traceback

sys.path.append("...")

import gc
import os
from concurrent.futures import ProcessPoolExecutor
from typing import Tuple

import numpy as np
import torch
from ncnn_vulkan import ncnn
from sanic.log import logger
from torch import Tensor

MAX_VALUES_BY_DTYPE = {
    np.dtype("int8"): 127,
    np.dtype("uint8"): 255,
    np.dtype("int16"): 32767,
    np.dtype("uint16"): 65535,
    np.dtype("int32"): 2147483647,
    np.dtype("uint32"): 4294967295,
    np.dtype("int64"): 9223372036854775807,
    np.dtype("uint64"): 18446744073709551615,
    np.dtype("float32"): 1.0,
    np.dtype("float64"): 1.0,
}


def bgr_to_rgb(image: Tensor) -> Tensor:
    # flip image channels
    # https://github.com/pytorch/pytorch/issues/229
    out: Tensor = image.flip(-3)
    # RGB to BGR #may be faster:
    # out: Tensor = image[[2, 1, 0], :, :]
    return out


def rgb_to_bgr(image: Tensor) -> Tensor:
    # same operation as bgr_to_rgb(), flip image channels
    return bgr_to_rgb(image)


def bgra_to_rgba(image: Tensor) -> Tensor:
    out: Tensor = image[[2, 1, 0, 3], :, :]
    return out


def rgba_to_bgra(image: Tensor) -> Tensor:
    # same operation as bgra_to_rgba(), flip image channels
    return bgra_to_rgba(image)


def denorm(x, min_max=(-1.0, 1.0)):
    """Denormalize from [-1,1] range to [0,1]
    formula: xi' = (xi - mu)/sigma
    Example: "out = (x + 1.0) / 2.0" for denorm
        range (-1,1) to (0,1)
    for use with proper act in Generator output (ie. tanh)
    """
    out = (x - min_max[0]) / (min_max[1] - min_max[0])
    if isinstance(x, Tensor):
        return out.clamp(0, 1)
    elif isinstance(x, np.ndarray):
        return np.clip(out, 0, 1)
    else:
        raise TypeError("Got unexpected object type, expected Tensor or np.ndarray")


def norm(x):
    """Normalize (z-norm) from [0,1] range to [-1,1]"""
    out = (x - 0.5) * 2.0
    if isinstance(x, Tensor):
        return out.clamp(-1, 1)
    elif isinstance(x, np.ndarray):
        return np.clip(out, -1, 1)
    else:
        raise TypeError("Got unexpected object type, expected Tensor or np.ndarray")


def np2tensor(
    img: np.ndarray,
    bgr2rgb=True,
    data_range=1.0,
    normalize=False,
    change_range=True,
    add_batch=True,
) -> Tensor:
    """Converts a numpy image array into a Tensor array.
    Parameters:
        img (numpy array): the input image numpy array
        add_batch (bool): choose if new tensor needs batch dimension added
    """
    if not isinstance(img, np.ndarray):  # images expected to be uint8 -> 255
        raise TypeError("Got unexpected object type, expected np.ndarray")
    # check how many channels the image has, then condition. ie. RGB, RGBA, Gray
    # if bgr2rgb:
    #     img = img[
    #         :, :, [2, 1, 0]
    #     ]  # BGR to RGB -> in numpy, if using OpenCV, else not needed. Only if image has colors.
    if change_range:
        dtype = img.dtype
        maxval = MAX_VALUES_BY_DTYPE.get(dtype, 1.0)
        t_dtype = np.dtype("float32")
        img = img.astype(t_dtype) / maxval  # ie: uint8 = /255
    img = torch.from_numpy(
        np.ascontiguousarray(np.transpose(img, (2, 0, 1)))
    ).float()  # "HWC to CHW" and "numpy to tensor"
    if bgr2rgb:
        # BGR to RGB -> in tensor, if using OpenCV, else not needed. Only if image has colors.)
        if (
            img.shape[0] % 3 == 0
        ):  # RGB or MultixRGB (3xRGB, 5xRGB, etc. For video tensors.)
            img = bgr_to_rgb(img)
        elif img.shape[0] == 4:  # RGBA
            img = bgra_to_rgba(img)
    if add_batch:
        img.unsqueeze_(
            0
        )  # Add fake batch dimension = 1 . squeeze() will remove the dimensions of size 1
    if normalize:
        img = norm(img)
    return img


def tensor2np(
    img: Tensor,
    rgb2bgr=True,
    remove_batch=True,
    data_range=255,
    denormalize=False,
    change_range=True,
    imtype=np.uint8,
) -> np.ndarray:
    """Converts a Tensor array into a numpy image array.
    Parameters:
        img (tensor): the input image tensor array
            4D(B,(3/1),H,W), 3D(C,H,W), or 2D(H,W), any range, RGB channel order
        remove_batch (bool): choose if tensor of shape BCHW needs to be squeezed
        denormalize (bool): Used to denormalize from [-1,1] range back to [0,1]
        imtype (type): the desired type of the converted numpy array (np.uint8
            default)
    Output:
        img (np array): 3D(H,W,C) or 2D(H,W), [0,255], np.uint8 (default)
    """
    if not isinstance(img, Tensor):
        raise TypeError("Got unexpected object type, expected Tensor")
    n_dim = img.dim()

    # TODO: Check: could denormalize here in tensor form instead, but end result is the same

    img = img.float().cpu()

    if n_dim in (4, 3):
        # if n_dim == 4, has to convert to 3 dimensions
        if n_dim == 4 and remove_batch:
            # remove a fake batch dimension
            img = img.squeeze(dim=0)

        if img.shape[0] == 3 and rgb2bgr:  # RGB
            # RGB to BGR -> in tensor, if using OpenCV, else not needed. Only if image has colors.
            img_np = rgb_to_bgr(img).numpy()
        elif img.shape[0] == 4 and rgb2bgr:  # RGBA
            # RGBA to BGRA -> in tensor, if using OpenCV, else not needed. Only if image has colors.
            img_np = rgba_to_bgra(img).numpy()
        else:
            img_np = img.numpy()
        img_np = np.transpose(img_np, (1, 2, 0))  # CHW to HWC
    elif n_dim == 2:
        img_np = img.numpy()
    else:
        raise TypeError(
            f"Only support 4D, 3D and 2D tensor. But received with dimension: {n_dim:d}"
        )

    # if rgb2bgr:
    # img_np = img_np[[2, 1, 0], :, :] #RGB to BGR -> in numpy, if using OpenCV, else not needed. Only if image has colors.
    # TODO: Check: could denormalize in the begining in tensor form instead
    if denormalize:
        img_np = denorm(img_np)  # denormalize if needed
    if change_range:
        img_np = np.clip(
            data_range * img_np, 0, data_range
        ).round()  # np.clip to the data_range

    # has to be in range (0,255) before changing to np.uint8, else np.float32
    return img_np.astype(imtype)


@torch.inference_mode()
def auto_split_process(
    lr_img: Tensor,
    model: torch.nn.Module,
    scale: int = 4,
    overlap: int = 32,
    max_depth: int = None,
    current_depth: int = 1,
) -> Tuple[Tensor, int]:
    # Original code: https://github.com/JoeyBallentine/ESRGAN/blob/master/utils/dataops.py

    # Prevent splitting from causing an infinite out-of-vram loop
    if current_depth > 15:
        torch.cuda.empty_cache()
        gc.collect()
        raise RuntimeError("Splitting stopped to prevent infinite loop")

    # Attempt to upscale if unknown depth or if reached known max depth
    if max_depth is None or max_depth == current_depth:
        try:
            d_img = lr_img.to(torch.device(os.environ["device"]))
            if os.environ["isFp16"] == "True":
                d_img = d_img.half()
            result = model(d_img).detach().cpu()
            del d_img
            return result, current_depth
        except RuntimeError as e:
            # Check to see if its actually the CUDA out of memory error
            if "allocate" in str(e) or "CUDA" in str(e):
                # Collect garbage (clear VRAM)
                torch.cuda.empty_cache()
                gc.collect()
            # Re-raise the exception if not an OOM error
            else:
                raise RuntimeError(e)

    b, c, h, w = lr_img.shape

    # Split image into 4ths
    top_left = lr_img[..., : h // 2 + overlap, : w // 2 + overlap]
    top_right = lr_img[..., : h // 2 + overlap, w // 2 - overlap :]
    bottom_left = lr_img[..., h // 2 - overlap :, : w // 2 + overlap]
    bottom_right = lr_img[..., h // 2 - overlap :, w // 2 - overlap :]

    # Recursively upscale the quadrants
    # After we go through the top left quadrant, we know the maximum depth and no longer need to test for out-of-memory
    top_left_rlt, depth = auto_split_process(
        top_left,
        model,
        scale=scale,
        overlap=overlap,
        current_depth=current_depth + 1,
    )
    top_right_rlt, _ = auto_split_process(
        top_right,
        model,
        scale=scale,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )
    bottom_left_rlt, _ = auto_split_process(
        bottom_left,
        model,
        scale=scale,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )
    bottom_right_rlt, _ = auto_split_process(
        bottom_right,
        model,
        scale=scale,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )

    # Define output shape
    out_h = h * scale
    out_w = w * scale

    # Create blank output image
    output_img = torch.empty(
        (b, c, out_h, out_w), dtype=lr_img.dtype, device=lr_img.device
    )

    # Fill output image with tiles, cropping out the overlaps
    output_img[..., : out_h // 2, : out_w // 2] = top_left_rlt[
        ..., : out_h // 2, : out_w // 2
    ]
    output_img[..., : out_h // 2, -out_w // 2 :] = top_right_rlt[
        ..., : out_h // 2, -out_w // 2 :
    ]
    output_img[..., -out_h // 2 :, : out_w // 2] = bottom_left_rlt[
        ..., -out_h // 2 :, : out_w // 2
    ]
    output_img[..., -out_h // 2 :, -out_w // 2 :] = bottom_right_rlt[
        ..., -out_h // 2 :, -out_w // 2 :
    ]

    return output_img, depth

# NCNN version of the above function
def ncnn_auto_split_process(
    lr_img: np.ndarray,
    net,
    scale: int = 4,
    overlap: int = 32,
    max_depth: int = None,
    current_depth: int = 1,
    input_name = 'data',
    output_name = 'output',
) -> Tuple[Tensor, int]:
    # Original code: https://github.com/JoeyBallentine/ESRGAN/blob/master/utils/dataops.py

    # Prevent splitting from causing an infinite out-of-vram loop
    if current_depth > 15:
        gc.collect()
        raise RuntimeError("Splitting stopped to prevent infinite loop")

    # Attempt to upscale if unknown depth or if reached known max depth
    if max_depth is None or max_depth == current_depth:
        ex = net.create_extractor()
        vkdev = ncnn.get_gpu_device(0)
        blob_vkallocator = ncnn.VkBlobAllocator(vkdev)
        staging_vkallocator = ncnn.VkStagingAllocator(vkdev)
        ex.set_blob_vkallocator(blob_vkallocator)
        ex.set_workspace_vkallocator(blob_vkallocator)
        ex.set_staging_vkallocator(staging_vkallocator)
        # ex.set_light_mode(True)
        try:
            mat_in = ncnn.Mat.from_pixels(
                (lr_img.copy() * 255).astype(np.uint8),
                ncnn.Mat.PixelType.PIXEL_BGR,
                lr_img.shape[1],
                lr_img.shape[0]
            )
            mean_vals = []
            norm_vals = [1 / 255.0, 1 / 255.0, 1 / 255.0]
            mat_in.substract_mean_normalize(mean_vals, norm_vals)
            ex.input(input_name, mat_in)
            _, mat_out = ex.extract(output_name)
            result = np.array(mat_out).transpose(1, 2, 0)
            del ex, mat_in, mat_out
            # Clear VRAM
            blob_vkallocator.clear()
            staging_vkallocator.clear()
            return result, current_depth
        except Exception as e:
            # Check to see if its actually the NCNN out of memory error
            if "failed" in str(e):
                # clear VRAM
                blob_vkallocator.clear()
                staging_vkallocator.clear()
                del ex, vkdev
                gc.collect()
            # Re-raise the exception if not an OOM error
            else:
                raise RuntimeError(e)

    h, w, c = lr_img.shape

    # Split image into 4ths
    top_left = lr_img[: h // 2 + overlap, : w // 2 + overlap, ...]
    top_right = lr_img[: h // 2 + overlap, w // 2 - overlap :, ...]
    bottom_left = lr_img[h // 2 - overlap :, : w // 2 + overlap, ...]
    bottom_right = lr_img[h // 2 - overlap :, w // 2 - overlap :, ...]

    # Recursively upscale the quadrants
    # After we go through the top left quadrant, we know the maximum depth and no longer need to test for out-of-memory
    top_left_rlt, depth = ncnn_auto_split_process(
        top_left,
        net,
        scale=scale,
        overlap=overlap,
        current_depth=current_depth + 1,
    )
    top_right_rlt, _ = ncnn_auto_split_process(
        top_right,
        net,
        scale=scale,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )
    bottom_left_rlt, _ = ncnn_auto_split_process(
        bottom_left,
        net,
        scale=scale,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )
    bottom_right_rlt, _ = ncnn_auto_split_process(
        bottom_right,
        net,
        scale=scale,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )

    # Define output shape
    out_h = h * scale
    out_w = w * scale

    # Create blank output image
    output_img = np.zeros(
        (out_h, out_w, c), dtype=lr_img.dtype
    )

    # Fill output image with tiles, cropping out the overlaps
    output_img[: out_h // 2, : out_w // 2, ...] = top_left_rlt[
        : out_h // 2, : out_w // 2, ...
    ]
    output_img[: out_h // 2, -out_w // 2 :, ...] = top_right_rlt[
        : out_h // 2, -out_w // 2 :, ...
    ]
    output_img[-out_h // 2 :, : out_w // 2, ...] = bottom_left_rlt[
        -out_h // 2 :, : out_w // 2, ...
    ]
    output_img[-out_h // 2 :, -out_w // 2 :, ...] = bottom_right_rlt[
        -out_h // 2 :, -out_w // 2 :, ...
    ]

    return output_img, depth
