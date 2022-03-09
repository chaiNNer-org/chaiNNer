import gc
from typing import Tuple

import numpy as np
from ncnn_vulkan import ncnn
from sanic.log import logger
from torch import Tensor


def fix_dtype_range(img):
    dtype_max = 1
    try:
        dtype_max = np.iinfo(img.dtype).max
    except:
        logger.info("img dtype is not an int")

    img = (np.clip(img.astype("float32") / dtype_max, 0, 1) * 255).astype(np.uint8)
    return img


# NCNN version of the 'auto_split_upscale' function
def ncnn_auto_split_process(
    lr_img: np.ndarray,
    net,
    overlap: int = 32,
    max_depth: int = None,
    current_depth: int = 1,
    input_name: str = "data",
    output_name: str = "output",
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
                lr_img.copy(),
                ncnn.Mat.PixelType.PIXEL_BGR,
                lr_img.shape[1],
                lr_img.shape[0],
            )
            mean_vals = []
            norm_vals = [1 / 255.0, 1 / 255.0, 1 / 255.0]
            mat_in.substract_mean_normalize(mean_vals, norm_vals)
            ex.input(input_name, mat_in)
            _, mat_out = ex.extract(output_name)
            result = fix_dtype_range(np.array(mat_out).transpose(1, 2, 0))
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

    h, w = lr_img.shape[:2]
    if lr_img.ndim > 2:
        c = lr_img.shape[2]
    else:
        c = 1

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
        overlap=overlap,
        current_depth=current_depth + 1,
    )
    top_right_rlt, _ = ncnn_auto_split_process(
        top_right,
        net,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )
    bottom_left_rlt, _ = ncnn_auto_split_process(
        bottom_left,
        net,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )
    bottom_right_rlt, _ = ncnn_auto_split_process(
        bottom_right,
        net,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )

    tl_h, _ = top_left.shape[:2]
    up_h, _ = top_left_rlt.shape[:2]
    scale = int(up_h / tl_h)

    # Define output shape
    out_h = h * scale
    out_w = w * scale

    # Create blank output image
    output_img = np.zeros((out_h, out_w, c), dtype=lr_img.dtype)

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
