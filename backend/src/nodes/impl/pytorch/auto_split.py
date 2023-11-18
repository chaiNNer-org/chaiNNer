from __future__ import annotations

import gc

import numpy as np
import torch

from ..upscale.auto_split import Split, Tiler, auto_split
from .utils import np2tensor, safe_cuda_cache_empty, tensor2np


@torch.inference_mode()
def pytorch_auto_split(
    img: np.ndarray,
    model: torch.nn.Module,
    device: torch.device,
    use_fp16: bool,
    tiler: Tiler,
) -> np.ndarray:
    model = model.to(device)
    model = model.half() if use_fp16 else model.float()

    def upscale(img: np.ndarray, _: object):
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
                    try:
                        d_img.detach().cpu()
                    except Exception:
                        pass
                    del d_img
                gc.collect()
                safe_cuda_cache_empty()
                return Split()
            else:
                # Re-raise the exception if not an OOM error
                raise

    try:
        return auto_split(img, upscale, tiler)
    finally:
        del model
        del device
        gc.collect()
        safe_cuda_cache_empty()
