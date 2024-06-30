from __future__ import annotations

import numpy as np

from api import NodeContext
from nodes.groups import Condition, if_group
from nodes.impl.onnx.model import OnnxRemBg
from nodes.impl.onnx.session import get_onnx_session
from nodes.impl.rembg.bg import remove_bg
from nodes.properties.inputs import ImageInput, OnnxRemBgModelInput
from nodes.properties.inputs.generic_inputs import BoolInput
from nodes.properties.inputs.numeric_inputs import NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput

from ...settings import get_settings
from .. import processing_group


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
            SliderInput("Foreground Threshold", min=1, max=255, default=240),
            SliderInput("Background Threshold", max=254, default=10),
            NumberInput("Erode Size", min=1, default=10),
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
        ImageOutput("Mask", size_as=0, channels=1),
    ],
    node_context=True,
)
def remove_background_node(
    context: NodeContext,
    img: np.ndarray,
    model: OnnxRemBg,
    post_process_mask: bool,
    alpha_matting: bool,
    foreground_threshold: int,
    background_threshold: int,
    kernel_size: int,
) -> tuple[np.ndarray, np.ndarray]:
    settings = get_settings(context)
    session = get_onnx_session(
        model,
        settings.gpu_index,
        settings.execution_provider,
        settings.tensorrt_fp16_mode,
        settings.tensorrt_cache_path,
    )

    # Remove alpha channel
    if img.shape[2] == 4:
        img = img[:, :, :3]

    return remove_bg(
        img,
        session,
        alpha_matting,
        foreground_threshold,
        background_threshold,
        alpha_matting_erode_size=kernel_size,
        post_process_mask=bool(post_process_mask),
    )
