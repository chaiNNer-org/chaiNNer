from __future__ import annotations

import gc

import numpy as np
import torch
from spandrel import MaskedImageModelDescriptor

import navi
from api import NodeContext
from nodes.impl.pytorch.utils import np2tensor, safe_cuda_cache_empty, tensor2np
from nodes.properties.inputs import ImageInput
from nodes.properties.inputs.pytorch_inputs import InpaintModelInput
from nodes.properties.outputs import ImageOutput

from ...settings import PyTorchSettings, get_settings
from .. import processing_group


def inpaint(
    img: np.ndarray,
    mask: np.ndarray,
    model: MaskedImageModelDescriptor,
    options: PyTorchSettings,
):
    with torch.no_grad():
        # TODO: use bfloat16 if RTX
        use_fp16 = options.use_fp16 and model.supports_half
        dtype = torch.float16 if use_fp16 else torch.float32
        device = options.device

        model = model.to(device, dtype)

        img_tensor = np2tensor(img, change_range=True)
        mask_tensor = np2tensor(mask, change_range=True)

        d_img = None
        d_mask = None
        try:
            d_img = img_tensor.to(device, dtype)

            d_mask = mask_tensor.to(device, dtype)
            d_mask = (d_mask > 0.5) * 1
            d_mask = d_mask.to(dtype)

            result = model(d_img, d_mask)
            result = tensor2np(
                result.detach().cpu().detach(),
                change_range=False,
                imtype=np.float32,
            )

            del d_img
            del d_mask

            return result
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
    name="修复",
    description=[
        "使用给定的蒙版对图像进行修复，使用 PyTorch 修复模型。",
        "蒙版通常必须在 chaiNNer 外部制作。",
        "支持的模型包括 LaMa 和 MAT。",
    ],
    icon="PyTorch",
    inputs=[
        ImageInput(channels=3),
        ImageInput(label="蒙版", channels=1).with_docs(
            "修复蒙版是一个灰度图像，其中白色表示要修复的区域，黑色表示要保留的区域。",
            "这通常必须在 chaiNNer 外部制作。",
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
        ).with_never_reason("给定的图像和蒙版必须具有相同的分辨率。")
    ],
    node_context=True,
)
def inpaint_node(
    context: NodeContext,
    img: np.ndarray,
    mask: np.ndarray,
    model: MaskedImageModelDescriptor,
) -> np.ndarray:
    assert (
        img.shape[:2] == mask.shape[:2]
    ), "输入图像和掩模必须具有相同的分辨率"

    exec_options = get_settings(context)

    return inpaint(img, mask, model, exec_options)
