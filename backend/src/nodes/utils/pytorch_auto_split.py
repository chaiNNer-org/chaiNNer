from __future__ import annotations

import gc
from typing import Tuple, Union

import torch
from sanic.log import logger
from torch import Tensor
import numpy as np

from .exec_options import ExecutionOptions
from .torch_types import PyTorchModel

from .auto_split import auto_split, Split
from .pytorch_utils import tensor2np, np2tensor


@torch.inference_mode()
def pytorch_auto_split(
    img: np.ndarray,
    model: PyTorchModel,
    device: torch.device,
    use_fp16: bool,
    max_tile_size: Union[int, None] = None,
) -> np.ndarray:
    model = model.to(device)
    model = model.half() if use_fp16 else model.float()

    def upscale(img: np.ndarray):
        img_tensor = np2tensor(img, change_range=True)

        d_img = None
        try:
            d_img = img_tensor.to(device)
            d_img = d_img.half() if use_fp16 else d_img.float()

            result = model(d_img)
            result = tensor2np(
                result.detach().cpu().detach(),
                change_range=False,
                imtype=np.float32,
            )

            del d_img
            return result
        except RuntimeError as e:
            # Check to see if its actually the CUDA out of memory error
            if "allocate" in str(e) or "CUDA" in str(e):
                # Collect garbage (clear VRAM)
                if d_img is not None:
                    d_img.detach().cpu()
                    del d_img
                gc.collect()
                torch.cuda.empty_cache()
                return Split()
            else:
                # Re-raise the exception if not an OOM error
                raise

    try:
        return auto_split(img, upscale, max_tile_size)
    finally:
        del model
        del device
        gc.collect()
        torch.cuda.empty_cache()


@torch.inference_mode()
def auto_split_process(
    exec_options: ExecutionOptions,
    lr_img: Tensor,
    model: PyTorchModel,
    scale: int,
    overlap: int = 16,
    max_depth: Union[int, None] = None,
    current_depth: int = 1,
) -> Tuple[Tensor, int]:
    """
    Run PyTorch upscaling with automatic recursive tile splitting based on ability to process with current size
    """
    # Original code: https://github.com/JoeyBallentine/ESRGAN/blob/master/utils/dataops.py

    logger.debug(
        f"auto_split_process: scale={scale}, overlap={overlap}, max_depth={max_depth}, current_depth={current_depth}"
    )

    # Prevent splitting from causing an infinite out-of-vram loop
    if current_depth > 15:
        torch.cuda.empty_cache()
        gc.collect()
        raise RuntimeError("Splitting stopped to prevent infinite loop")

    # Attempt to upscale if unknown depth or if reached known max depth
    if max_depth is None or max_depth == current_depth:
        d_img = None
        try:
            device = torch.device(exec_options.device)
            d_img = lr_img.to(device)
            model = model.to(device)
            should_use_fp16 = exec_options.fp16 and model.supports_fp16
            if should_use_fp16:
                d_img = d_img.half()
                model = model.half()
            else:
                d_img = d_img.float()
                model = model.float()
            result = model(d_img)
            result = result.detach().cpu()
            del d_img
            return result, current_depth
        except RuntimeError as e:
            # Check to see if its actually the CUDA out of memory error
            if "allocate" in str(e) or "CUDA" in str(e):
                # Collect garbage (clear VRAM)
                if d_img is not None:
                    d_img.detach().cpu()
                    del d_img
                gc.collect()
                torch.cuda.empty_cache()
            # Re-raise the exception if not an OOM error
            else:
                raise
    # Allow to attempt going one more deep before erroring
    elif (max_depth + 1) < current_depth:
        raise ValueError(
            "A VRAM out-of-memory error has occurred. Please try using a more extreme tiling mode."
        )

    b, c, h, w = lr_img.shape

    # Split image into 4ths
    top_left = lr_img[..., : h // 2 + overlap, : w // 2 + overlap]
    top_right = lr_img[..., : h // 2 + overlap, w // 2 - overlap :]
    bottom_left = lr_img[..., h // 2 - overlap :, : w // 2 + overlap]
    bottom_right = lr_img[..., h // 2 - overlap :, w // 2 - overlap :]

    # Recursively upscale the quadrants
    # After we go through the top left quadrant, we know the maximum depth and no longer need to test for out-of-memory
    top_left_rlt, depth = auto_split_process(
        exec_options,
        top_left,
        model,
        scale=scale,
        overlap=overlap,
        max_depth=max_depth,
        current_depth=current_depth + 1,
    )
    del top_left
    top_right_rlt, _ = auto_split_process(
        exec_options,
        top_right,
        model,
        scale=scale,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )
    del top_right
    bottom_left_rlt, _ = auto_split_process(
        exec_options,
        bottom_left,
        model,
        scale=scale,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )
    del bottom_left
    bottom_right_rlt, _ = auto_split_process(
        exec_options,
        bottom_right,
        model,
        scale=scale,
        overlap=overlap,
        max_depth=depth,
        current_depth=current_depth + 1,
    )
    del bottom_right

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
    del top_left_rlt
    output_img[..., : out_h // 2, -out_w // 2 :] = top_right_rlt[
        ..., : out_h // 2, -out_w // 2 :
    ]
    del top_right_rlt
    output_img[..., -out_h // 2 :, : out_w // 2] = bottom_left_rlt[
        ..., -out_h // 2 :, : out_w // 2
    ]
    del bottom_left_rlt
    output_img[..., -out_h // 2 :, -out_w // 2 :] = bottom_right_rlt[
        ..., -out_h // 2 :, -out_w // 2 :
    ]
    del bottom_right_rlt
    gc.collect()

    return output_img, depth
