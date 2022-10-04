from __future__ import annotations

import gc
from typing import Union

import numpy as np
from ncnn_vulkan import ncnn
from sanic.log import logger

from .auto_split import auto_split, Split
from .utils import get_h_w_c


def fix_dtype_range(img):
    dtype_max = 1
    try:
        dtype_max = np.iinfo(img.dtype).max
    except:
        logger.debug("img dtype is not an int")

    img = (
        (np.clip(img.astype("float32") / dtype_max, 0, 1) * 255)
        .round()
        .astype(np.uint8)
    )
    return img


def ncnn_auto_split(
    img: np.ndarray,
    net,
    input_name: str,
    output_name: str,
    blob_vkallocator,
    staging_vkallocator,
    max_tile_size: Union[int, None] = None,
) -> np.ndarray:
    def upscale(img: np.ndarray):
        ex = net.create_extractor()
        ex.set_blob_vkallocator(blob_vkallocator)
        ex.set_workspace_vkallocator(blob_vkallocator)
        ex.set_staging_vkallocator(staging_vkallocator)
        # ex.set_light_mode(True)
        try:
            lr_c = get_h_w_c(img)[2]
            lr_img_fix = fix_dtype_range(img)
            if lr_c == 1:
                pixel_type = ncnn.Mat.PixelType.PIXEL_GRAY
            elif lr_c == 3:
                pixel_type = ncnn.Mat.PixelType.PIXEL_RGB
            else:
                pixel_type = ncnn.Mat.PixelType.PIXEL_RGBA
            mat_in = ncnn.Mat.from_pixels(
                lr_img_fix,
                pixel_type,
                lr_img_fix.shape[1],
                lr_img_fix.shape[0],
            )
            mean_vals = []
            norm_vals = [1 / 255.0] * lr_c
            mat_in.substract_mean_normalize(mean_vals, norm_vals)
            ex.input(input_name, mat_in)
            _, mat_out = ex.extract(output_name)
            result = np.array(mat_out).transpose(1, 2, 0).astype(np.float32)
            del ex, mat_in, mat_out
            gc.collect()
            # Clear VRAM
            return result
        except Exception as e:
            # Check to see if its actually the NCNN out of memory error
            if "failed" in str(e):
                # clear VRAM
                logger.info(f"NCNN out of VRAM, clearing VRAM and splitting.")
                ex = None
                del ex
                gc.collect()
                return Split()
            else:
                # Re-raise the exception if not an OOM error
                raise

    return auto_split(img, upscale, max_tile_size)
