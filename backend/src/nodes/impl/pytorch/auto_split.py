from __future__ import annotations

import gc

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
            # convert to tensor
            img = np.ascontiguousarray(img)
            if not img.flags.writeable and device == torch.device("cpu"):
                img = np.copy(img)
            else:
                # since we are going to copy the image to the GPU, we can skip the copy here
                img.flags.writeable = True
            input_tensor = torch.from_numpy(img).to(device, dtype)
            img.flags.writeable = False
            input_tensor = _rgb_to_bgr(input_tensor)
            input_tensor = _into_batched_form(input_tensor)

            # inference
            output_tensor = model(input_tensor)

            # convert back to numpy
            output_tensor = _into_standard_image_form(output_tensor)
            output_tensor = _rgb_to_bgr(output_tensor)
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

    return auto_split(img, upscale, tiler)
