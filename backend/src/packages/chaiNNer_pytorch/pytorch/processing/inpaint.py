from __future__ import annotations

import gc
from typing import Optional

import numpy as np
import torch

import navi
from nodes.impl.image_utils import as_3d
from nodes.impl.pytorch.types import PyTorchInpaintModel
from nodes.impl.pytorch.utils import np2tensor, safe_cuda_cache_empty, tensor2np
from nodes.properties.inputs import ImageInput
from nodes.properties.inputs.pytorch_inputs import InpaintModelInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from ...settings import PyTorchSettings, get_settings
from .. import processing_group


def ceil_modulo(x: int, mod: int) -> int:
    if x % mod == 0:
        return x
    return (x // mod + 1) * mod


def pad_img_to_modulo(
    img: np.ndarray,
    mod: int,
    square: bool = False,
    min_size: Optional[int] = None,
):
    img = as_3d(img)
    h, w, _ = get_h_w_c(img)
    out_h = ceil_modulo(h, mod)
    out_w = ceil_modulo(w, mod)

    if min_size is not None:
        assert min_size % mod == 0
        out_w = max(min_size, out_w)
        out_h = max(min_size, out_h)

    if square:
        max_size = max(out_h, out_w)
        out_h = max_size
        out_w = max_size

    return np.pad(img, ((0, out_h - h), (0, out_w - w), (0, 0)), mode="symmetric")


def inpaint(
    img: np.ndarray,
    mask: np.ndarray,
    model: PyTorchInpaintModel,
    options: PyTorchSettings,
):
    with torch.no_grad():
        # TODO: use bfloat16 if RTX
        use_fp16 = options.use_fp16 and model.supports_fp16
        device = options.device

        model = model.to(device)
        model = model.half() if use_fp16 else model.float()

        orig_height, orig_width, _ = get_h_w_c(img)

        img = pad_img_to_modulo(img, model.pad_mod, model.pad_to_square, model.min_size)
        mask = pad_img_to_modulo(
            mask, model.pad_mod, model.pad_to_square, model.min_size
        )

        img_tensor = np2tensor(img, change_range=True)
        mask_tensor = np2tensor(mask, change_range=True)

        d_img = None
        d_mask = None
        try:
            d_img = img_tensor.to(device)
            d_img = d_img.half() if use_fp16 else d_img.float()

            d_mask = mask_tensor.to(device)
            d_mask = (d_mask > 0.5) * 1
            d_mask = d_mask.half() if use_fp16 else d_mask.float()

            result = model(d_img, d_mask)
            result = tensor2np(
                result.detach().cpu().detach(),
                change_range=False,
                imtype=np.float32,
            )

            del d_img
            del d_mask

            return result[0:orig_height, 0:orig_width]
        except RuntimeError:
            # Collect garbage (clear VRAM)
            if d_img is not None:
                try:
                    d_img.detach().cpu()
                except Exception:
                    pass
                del d_img
            if d_mask is not None:
                try:
                    d_mask.detach().cpu()
                except Exception:
                    pass
                del d_mask
            gc.collect()
            safe_cuda_cache_empty()

            raise


@processing_group.register(
    schema_id="chainner:pytorch:inpaint",
    name="Inpaint",
    description=[
        "Inpaint an image with given mask, using a PyTorch inpainting model.",
        "Masks must typically be made outside of chaiNNer.",
        "Supported models include LaMa and MAT",
    ],
    icon="PyTorch",
    inputs=[
        ImageInput(channels=3),
        ImageInput(label="Mask", channels=1).with_docs(
            "An inpainting mask is a grayscale image where white represents what to inpaint and black represents what to keep.",
            "This must typically be made outside of chaiNNer.",
            hint=True,
        ),
        InpaintModelInput(),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                width="Input0.width & Input1.width",
                height="Input0.height & Input1.height",
            ),
            channels=3,
        ).with_never_reason("The given image and mask must have the same resolution.")
    ],
)
def inpaint_node(
    img: np.ndarray,
    mask: np.ndarray,
    model: PyTorchInpaintModel,
) -> np.ndarray:
    """Inpaint an image"""

    assert (
        img.shape[:2] == mask.shape[:2]
    ), "Input image and mask must have the same resolution"

    exec_options = get_settings()

    return inpaint(img, mask, model, exec_options)
