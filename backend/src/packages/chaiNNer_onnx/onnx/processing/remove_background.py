from __future__ import annotations

from typing import TYPE_CHECKING

import navi
from nodes.groups import Condition, if_group
from nodes.impl.onnx.session import get_onnx_session
from nodes.impl.rembg.bg import remove_bg
from nodes.properties.inputs import ImageInput, OnnxRemBgModelInput
from nodes.properties.inputs.generic_inputs import BoolInput
from nodes.properties.inputs.numeric_inputs import NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput

from ...settings import get_settings
from .. import processing_group

if TYPE_CHECKING:
    import numpy as np

    from nodes.impl.onnx.model import OnnxRemBg


@processing_group.register(
    schema_id="chainner:onnx:rembg",
    name="Remove Background",
    description="""Removes background from image.
        Currently supports u2net models from the rembg project (links found in readme).""",
    icon="ONNX",
    see_also="chainner:image:alpha_matting",
    inputs=[
        ImageInput(channels=[3, 4]).with_docs(
            "If the image has an alpha channel, it will be ignored."
        ),
        OnnxRemBgModelInput(),
        BoolInput("Post-process Mask", default=False),
        BoolInput("Alpha Matting", default=False),
        if_group(Condition.bool(3, True))(
            SliderInput("Foreground Threshold", minimum=1, maximum=255, default=240),
            SliderInput("Background Threshold", maximum=254, default=10),
            NumberInput("Erode Size", minimum=1, default=10),
        ),
    ],
    outputs=[
        ImageOutput(
            "Image",
            image_type="""
                let image = Input0;
                let model = Input1;

                Image {
                    width: image.width,
                    height: image.height * model.scaleHeight,
                }
            """,
            channels=4,
        ),
        ImageOutput("Mask", image_type=navi.Image(size_as="Input0"), channels=1),
    ],
    limited_to_8bpc=True,
)
def remove_background_node(
    img: np.ndarray,
    model: OnnxRemBg,
    post_process_mask: bool,
    alpha_matting: bool,
    foreground_threshold: int,
    background_threshold: int,
    kernel_size: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Removes background from image"""

    settings = get_settings()
    session = get_onnx_session(
        model,
        settings.gpu_index,
        settings.execution_provider,
        settings.tensorrt_fp16_mode,
        settings.tensorrt_cache_path,
    )

    return remove_bg(
        img,
        session,
        alpha_matting,
        foreground_threshold,
        background_threshold,
        alpha_matting_erode_size=kernel_size,
        post_process_mask=bool(post_process_mask),
    )
