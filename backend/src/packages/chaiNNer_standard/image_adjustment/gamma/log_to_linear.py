from __future__ import annotations

import numpy as np

from nodes.properties.inputs import BoolInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import gamma_group


@gamma_group.register(
    schema_id="chainner:image:log2lin",
    description="Convert all channels in an image to a scene linear encoding using the Kodak Cineon logarithmic function set.",
    name="Log To Linear",
    icon="ImBrightnessContrast",
    inputs=[
        ImageInput(),
        SliderInput("Black", min=0.0, max=1023, default=95.0, precision=1, step=1),
        SliderInput("White", min=0.0, max=1023, default=685.0, precision=1, step=1),
        SliderInput(
            "Gamma",
            min=0.0001,
            max=1.0,
            default=0.6,
            precision=2,
            step=0.0001,
            scale="log",
        ),
        BoolInput("Invert Log to Linear", default=False).with_docs(
            "When checked this will convert the input image back to the Kodak Cineon Logarithmic encoding"
        ),
    ],
    outputs=[ImageOutput(shape_as=0)],
)
def log_to_linear_node(
    img: np.ndarray,
    black: float,
    white: float,
    gamma: float,
    invert_log_to_linear: bool,
) -> np.ndarray:
    offset = pow(10.0, (black - white) * 0.002 / gamma)
    gain = 1.0 / (1.0 - offset)

    if not invert_log_to_linear:
        img = gain * (pow(10.0, (1023.0 * img - white) * 0.002 / gamma) - offset)
    else:
        img = (np.log10(img / gain + offset) / (0.002 / gamma) + white) / 1023.0
    return img
