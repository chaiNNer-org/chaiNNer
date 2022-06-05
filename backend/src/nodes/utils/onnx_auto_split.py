from __future__ import annotations

import gc
from typing import Tuple, Union

import numpy as np
import onnxruntime
from sanic.log import logger


# NCNN version of the 'auto_split_upscale' function
def onnx_auto_split_process(
    lr_img: np.ndarray,
    session: onnxruntime.InferenceSession,
    overlap: int = 16,
    max_depth: Union[int, None] = None,
    current_depth: int = 1,
) -> Tuple[np.ndarray, int]:
    """
    Run NCNN upscaling with automatic recursive tile splitting based on ability to process with current size
    """
    # Original code: https://github.com/JoeyBallentine/ESRGAN/blob/master/utils/dataops.py

    # if os.environ["killed"] == "True":
    #     ncnn.destroy_gpu_instance()
    #     gc.collect()
    #     raise RuntimeError("Upscaling killed mid-processing")

    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    # Prevent splitting from causing an infinite out-of-vram loop
    if current_depth > 15:
        gc.collect()
        raise RuntimeError("Splitting stopped to prevent infinite loop")

    # Attempt to upscale if unknown depth or if reached known max depth
    if max_depth is None or max_depth == current_depth:
        try:
            output: np.ndarray = session.run([output_name], {input_name: lr_img})[0]
            return output.copy(), current_depth
        except Exception as e:
            if "ONNXRuntimeError" in str(e) and "allocate memory" in str(e):
                gc.collect()
            else:
                # Re-raise the exception if not an OOM error
                raise

    b, c, h, w = lr_img.shape

    # Split image into 4ths
    top_left = lr_img[..., : h // 2 + overlap, : w // 2 + overlap]
    top_right = lr_img[..., : h // 2 + overlap, w // 2 - overlap :]
    bottom_left = lr_img[..., h // 2 - overlap :, : w // 2 + overlap]
    bottom_right = lr_img[..., h // 2 - overlap :, w // 2 - overlap :]

    # Recursively upscale the quadrants
    # After we go through the top left quadrant, we know the maximum depth and no longer need to test for out-of-memory
    top_left_rlt, depth = onnx_auto_split_process(
        top_left,
        session,
        overlap=overlap,
        max_depth=max_depth,
        current_depth=current_depth + 1,
    )
    top_right_rlt, _ = onnx_auto_split_process(
        top_right,
        session,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )
    bottom_left_rlt, _ = onnx_auto_split_process(
        bottom_left,
        session,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )
    bottom_right_rlt, _ = onnx_auto_split_process(
        bottom_right,
        session,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )

    tl_h = top_left.shape[-2]
    up_h = top_left_rlt.shape[-2]
    scale = int(up_h / tl_h)

    # Define output shape
    out_h = h * scale
    out_w = w * scale

    # Create blank output image
    output_img = np.zeros((b, c, out_h, out_w), dtype=lr_img.dtype)

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

    return output_img.copy(), depth
