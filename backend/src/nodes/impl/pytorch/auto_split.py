from __future__ import annotations

import gc

import torch
import numpy as np

from .types import PyTorchModel

from ..upscale.auto_split import auto_split, Split, Tiler
from .utils import tensor2np, np2tensor


@torch.inference_mode()
def pytorch_auto_split(
    img: np.ndarray,
    model: PyTorchModel,
    device: torch.device,
    use_fp16: bool,
    tiler: Tiler,
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
                    try:
                        d_img.detach().cpu()
                    except:
                        pass
                    del d_img
                gc.collect()
                torch.cuda.empty_cache()
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
        torch.cuda.empty_cache()
