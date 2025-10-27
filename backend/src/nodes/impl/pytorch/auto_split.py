from __future__ import annotations

import gc
from typing import Callable

import numpy as np
import torch
from spandrel import ImageModelDescriptor

from api import Progress

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


def _pad(
    img: np.ndarray, model: ImageModelDescriptor[torch.nn.Module]
) -> tuple[np.ndarray, Callable[[np.ndarray], np.ndarray]]:
    """
    Pads the image to satisfy the model's size requirements.
    Returns the padded image and a function to remove the padding from the output.
    """
    h, w = img.shape[:2]

    pad_w, pad_h = model.size_requirements.get_padding(w, h)

    def remove_padding(output: np.ndarray) -> np.ndarray:
        if pad_w == 0 and pad_h == 0:
            return output

        out_h, out_w = output.shape[:2]
        scale_w = out_w // (w + pad_w)
        scale_h = out_h // (h + pad_h)
        new_pad_w = int(pad_w * scale_w)
        new_pad_h = int(pad_h * scale_h)

        if new_pad_w > 0 or new_pad_h > 0:
            return output[: out_h - new_pad_h, : out_w - new_pad_w]
        return output

    if pad_w > 0 or pad_h > 0:
        # Pad with reflection
        paddings = [(0, pad_h), (0, pad_w)]
        if len(img.shape) == 3:
            paddings.append((0, 0))
        img = np.pad(img, paddings, "reflect")

    return img, remove_padding


def _into_tensor(
    img: np.ndarray, device: torch.device, dtype: torch.dtype
) -> torch.Tensor:
    img = np.ascontiguousarray(img)
    writeable = img.flags.writeable
    try:
        if not writeable and device == torch.device("cpu"):
            img = np.copy(img)
        else:
            # since we are going to copy the image to the GPU, we can skip the copy here
            try:
                img.flags.writeable = True
            except Exception:
                # Some arrays cannot be made writeable, and we need to copy them
                img = np.copy(img)
        input_tensor = torch.from_numpy(img).to(device, dtype)
        return input_tensor
    finally:
        img.flags.writeable = writeable


@torch.inference_mode()
def pytorch_auto_split(
    img: np.ndarray,
    model: ImageModelDescriptor[torch.nn.Module],
    device: torch.device,
    use_fp16: bool,
    tiler: Tiler,
    progress: Progress,
) -> np.ndarray:
    dtype = torch.float16 if use_fp16 else torch.float32
    if model.dtype != dtype or model.device != device:
        model = model.to(device, dtype)

    def upscale(img: np.ndarray, _: object):
        progress.check_aborted()
        if progress.paused:
            # clear resources before pausing
            gc.collect()
            safe_cuda_cache_empty()
            progress.suspend()

        input_tensor = None
        try:
            # Apply padding to satisfy size requirements
            padded_img, remove_padding = _pad(img, model)

            # convert to tensor
            input_tensor = _into_tensor(padded_img, device, dtype)
            input_tensor = _rgb_to_bgr(input_tensor)
            input_tensor = _into_batched_form(input_tensor)

            # inference
            output_tensor = model(input_tensor)

            # convert back to numpy
            output_tensor = _into_standard_image_form(output_tensor)
            output_tensor = _rgb_to_bgr(output_tensor)
            result = output_tensor.detach().cpu().detach().float().numpy()

            # Remove padding from output
            result = remove_padding(result)

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

    return auto_split(img, upscale, tiler)
