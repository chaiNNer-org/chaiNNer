"""Auto-tiling support for TensorRT inference."""

from __future__ import annotations

import gc

import numpy as np

from ..upscale.auto_split import Tiler, auto_split
from .inference import get_tensorrt_session
from .model import TensorRTEngine


def _into_batched_form(img: np.ndarray) -> np.ndarray:
    """Convert image to NCHW batched format."""
    shape_size = len(img.shape)
    if shape_size == 3:
        # (H, W, C) -> (1, C, H, W)
        return img.transpose((2, 0, 1))[np.newaxis, :]
    elif shape_size == 2:
        # (H, W) -> (1, 1, H, W)
        return img[np.newaxis, np.newaxis, :, :]
    else:
        raise ValueError("Unsupported input tensor shape")


def _into_standard_image_form(img: np.ndarray) -> np.ndarray:
    """Convert NCHW output back to HWC format."""
    shape_size = len(img.shape)
    if shape_size == 4:
        # (1, C, H, W) -> (H, W, C)
        return img.squeeze(0).transpose(1, 2, 0)
    elif shape_size == 3:
        # (C, H, W) -> (H, W, C)
        return img.transpose(1, 2, 0)
    elif shape_size == 2:
        # (H, W)
        return img
    else:
        raise ValueError("Unsupported output tensor shape")


def tensorrt_auto_split(
    img: np.ndarray,
    engine: TensorRTEngine,
    tiler: Tiler,
    gpu_index: int = 0,
) -> np.ndarray:
    """
    Run TensorRT inference with automatic tiling for large images.

    Args:
        img: Input image in HWC format (float32, 0-1 range)
        engine: TensorRT engine
        tiler: Tiler configuration for splitting
        gpu_index: GPU device index

    Returns:
        Upscaled image in HWC format
    """
    session = get_tensorrt_session(engine, gpu_index)
    is_fp16 = engine.precision == "fp16"

    def upscale(img: np.ndarray, _: object):
        try:
            # Convert to appropriate precision
            lr_img = img.astype(np.float16) if is_fp16 else img.astype(np.float32)

            # Convert to NCHW batched format
            lr_img = _into_batched_form(lr_img)

            # Run inference
            output = session.infer(lr_img)

            # Convert back to HWC format
            output = _into_standard_image_form(output)

            return output.astype(np.float32)

        except Exception as e:
            error_str = str(e).lower()
            # Check for CUDA OOM errors
            if (
                "out of memory" in error_str
                or "cuda" in error_str and "memory" in error_str
                or "allocation" in error_str
            ):
                raise RuntimeError(  # noqa: B904
                    "A VRAM out-of-memory error has occurred. Please try using a smaller tile size."
                )
            else:
                # Re-raise the exception if not an OOM error
                raise

    try:
        return auto_split(img, upscale, tiler)
    finally:
        gc.collect()
