from __future__ import annotations

from typing import Tuple

import numpy as np

from nodes.groups import Condition, if_group
from nodes.impl.onnx.model import OnnxRemBg
from nodes.impl.onnx.session import get_onnx_session
from nodes.impl.rembg.bg import remove_bg
from nodes.properties import expression
from nodes.properties.inputs import ImageInput, OnnxRemBgModelInput
from nodes.properties.inputs.generic_inputs import BoolInput
from nodes.properties.inputs.numeric_inputs import NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.exec_options import get_execution_options

from .. import processing_group


@processing_group.register(
    schema_id="chainner:onnx:rembg",
    name="Remove Background",
    description="""Removes background from image.
        Currently supports u2net models from the rembg project (links found in readme).""",
    icon="ONNX",
    inputs=[
        ImageInput(),
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
            image_type="""removeBackground(Input1, Input0)""",
        ),
        ImageOutput("Mask", image_type=expression.Image(size_as="Input0"), channels=1),
    ],
)
def rembg_node(
    img: np.ndarray,
    model: OnnxRemBg,
    post_process_mask: int,
    alpha_matting: int,
    foreground_threshold: int,
    background_threshold: int,
    kernel_size: int,
) -> Tuple[np.ndarray, np.ndarray]:
    """Removes background from image"""

    session = get_onnx_session(model, get_execution_options())

    return remove_bg(
        img,
        session,
        bool(alpha_matting),
        foreground_threshold,
        background_threshold,
        alpha_matting_erode_size=kernel_size,
        post_process_mask=bool(post_process_mask),
    )
