from __future__ import annotations

import gc

import numpy as np
import torch
from spandrel import ImageModelDescriptor, SizeRequirements

from ..upscale.auto_split import Split, Tiler, auto_split
from .utils import safe_cuda_cache_empty


def _into_standard_image_form(t: torch.Tensor) -> torch.Tensor:
    if len(t.shape) == 2:
        # (H, W)
        return t
    elif len(t.shape) == 3:
        # (C, H, W) -> (H, W, C)
        return t.permute(1, 2, 0)
    elif len(t.shape) == 4:
        # (1, C, H, W) -> (H, W, C)
        return t.squeeze(0).permute(1, 2, 0)
    else:
        raise ValueError("Unsupported output tensor shape")


def _into_batched_form(t: torch.Tensor) -> torch.Tensor:
    if len(t.shape) == 2:
        # (H, W) -> (1, 1, H, W)
        return t.unsqueeze(0).unsqueeze(0)
    elif len(t.shape) == 3:
        # (H, W, C) -> (1, C, H, W)
        return t.permute(2, 0, 1).unsqueeze(0)
    else:
        raise ValueError("Unsupported input tensor shape")


def _rgb_to_bgr(t: torch.Tensor) -> torch.Tensor:
    if len(t.shape) == 3 and t.shape[2] == 3:
        # (H, W, C) RGB -> BGR
        return t.flip(2)
    elif len(t.shape) == 3 and t.shape[2] == 4:
        # (H, W, C) RGBA -> BGRA
        return torch.cat((t[:, :, 2:3], t[:, :, 1:2], t[:, :, 0:1], t[:, :, 3:4]), 2)
    else:
        return t


def _pad(t: torch.Tensor, req: SizeRequirements):
    _, _, h, w = t.shape

    minimum = req.minimum
    multiple_of = req.multiple_of

    pad_h = (multiple_of - (h % multiple_of)) % multiple_of
    if h + pad_h < minimum:
        pad_h = minimum - h

    pad_w = (multiple_of - (w % multiple_of)) % multiple_of
    if w + pad_w < minimum:
        pad_w = minimum - w

    if pad_w or pad_h:
        return True, torch.nn.functional.pad(t, (0, pad_w, 0, pad_h), "reflect")
    else:
        return False, t


@torch.inference_mode()
def pytorch_auto_split(
    img: np.ndarray,
    model: ImageModelDescriptor[torch.nn.Module],
    device: torch.device,
    use_fp16: bool,
    tiler: Tiler,
) -> np.ndarray:
    model = model.to(device)
    if use_fp16:
        model.model.half()
    else:
        model.model.float()

    def upscale(img: np.ndarray, _: object):
        input_tensor = None
        try:
            # convert to tensor
            input_tensor = torch.from_numpy(np.ascontiguousarray(img)).to(device)
            input_tensor = input_tensor.half() if use_fp16 else input_tensor.float()
            input_tensor = _rgb_to_bgr(input_tensor)
            input_tensor = _into_batched_form(input_tensor)

            # pad to meat size requirements
            _, _, org_h, org_w = input_tensor.shape
            did_pad, input_tensor = _pad(input_tensor, model.size_requirements)

            # inference
            output_tensor = model(input_tensor)

            if did_pad:
                # crop to original (scaled) size
                output_tensor = output_tensor[
                    :, :, : (org_h * model.scale), : (org_w * model.scale)
                ]

            # convert back to numpy
            output_tensor = _into_standard_image_form(output_tensor)
            output_tensor = _rgb_to_bgr(output_tensor)
            output_tensor = output_tensor.clip_(0, 1)
            result = output_tensor.detach().cpu().detach().float().numpy()

            return result
        except RuntimeError as e:
            # Check to see if its actually the CUDA out of memory error
            if "allocate" in str(e) or "CUDA" in str(e):
                # Collect garbage (clear VRAM)
                if input_tensor is not None:
                    try:
                        input_tensor.detach().cpu()
                    except Exception:
                        pass
                    del input_tensor
                gc.collect()
                safe_cuda_cache_empty()
                return Split()
            else:
                # Re-raise the exception if not an OOM error
                raise

    try:
        return auto_split(img, upscale, tiler)
    finally:
        safe_cuda_cache_empty()
