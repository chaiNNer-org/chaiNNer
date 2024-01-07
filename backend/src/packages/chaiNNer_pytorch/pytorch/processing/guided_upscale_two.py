from __future__ import annotations

import numpy as np
import torch
from spandrel import GuidedImageModelDescriptor

from nodes.impl.pytorch.utils import safe_cuda_cache_empty
from nodes.impl.upscale.grayscale import SplitMode
from nodes.properties.inputs import EnumInput, GuidedModelInput, ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from ...settings import get_settings
from .. import processing_group


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


@processing_group.register(
    schema_id="chainner:pytorch:guided_upscale_two",
    name="Guided Upscale Two",
    description=(
        "Upscales a source image using a guide."
        " This is most useful for very small source images."
        "\n\nUnder the hood, PixTransform is used which trains a NN to convert the guide image into the source image."
        " Note that this operation is very expensive, because it needs to train a NN."
        " Try a small number of iterations before going up to around 30k."
    ),
    icon="PyTorch",
    inputs=[
        ImageInput("Source"),
        ImageInput("Guide"),
        GuidedModelInput(),
        EnumInput(
            SplitMode,
            "Channel split mode",
            SplitMode.LAB,
            option_labels={SplitMode.RGB: "RGB", SplitMode.LAB: "L*a*b"},
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let source = Input0;
                let guide = Input1;

                let valid = bool::and(
                    // guide image must be larger than source image
                    guide.width > source.width,
                    // guide image's size must be `k * source.size` for `k>1`
                    guide.width / source.width == int,
                    guide.width / source.width == guide.height / source.height
                );

                Image {
                    width: guide.width,
                    height: guide.height,
                    channels: source.channels,
                } & if valid { any } else { never }
                """
        ).with_never_reason(
            "The guide image must be larger than the source image, and the size of the guide image must be an integer multiple of the size of the source image (e.g. 2x, 3x, 4x, ...)."
        ),
    ],
)
def guided_upscale_two_node(
    source: np.ndarray,
    guide: np.ndarray,
    model: GuidedImageModelDescriptor,
    split_mode: SplitMode,
) -> np.ndarray:
    s_h, s_w, s_c = get_h_w_c(source)
    g_h, g_w, g_c = get_h_w_c(guide)

    scale = model.scale
    assert s_h * scale == g_h and s_w * scale == g_w

    device = get_settings().device
    model.to(device)
    model.eval()

    with torch.no_grad():
        try:
            # convert to tensor
            guide_tensor = torch.from_numpy(np.ascontiguousarray(guide)).to(device)
            guide_tensor = guide_tensor.float()
            guide_tensor = _into_batched_form(guide_tensor)

            source_tensor = torch.from_numpy(np.ascontiguousarray(source)).to(device)
            source_tensor = source_tensor.float()
            source_tensor = _into_batched_form(source_tensor)

            # inference
            output_tensor = model(source_tensor, guide_tensor)

            # convert back to numpy
            output_tensor = _into_standard_image_form(output_tensor)
            output_tensor = output_tensor.clip_(0, 1)
            result = output_tensor.detach().cpu().detach().float().numpy()

            return result
        except RuntimeError as e:
            raise RuntimeError("Error during inference") from e
        finally:
            safe_cuda_cache_empty()
