from __future__ import annotations

import numpy as np

import navi
from nodes.groups import from_to_dropdowns_group, if_enum_group
from nodes.impl.color.convert import (
    color_space_from_id,
    color_space_or_detector_from_id,
    convert,
)
from nodes.impl.color.convert_data import color_spaces, get_alpha_partner
from nodes.properties.inputs import (
    BoolInput,
    ColorSpaceDetectorInput,
    ColorSpaceInput,
    ImageInput,
)
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group

COLOR_SPACES_WITH_ALPHA_PARTNER = [
    c.id for c in color_spaces if get_alpha_partner(c) is not None
]


@miscellaneous_group.register(
    schema_id="chainner:image:change_colorspace",
    name="Change Color Model",
    description=(
        "Convert the color model of an image to a different one. "
        "Also can convert to different channel-spaces."
    ),
    icon="MdColorLens",
    inputs=[
        ImageInput(image_type=navi.Image(channels="Input1.channels")),
        from_to_dropdowns_group(
            ColorSpaceDetectorInput(label="From").with_id(1),
            ColorSpaceInput(label="To").with_id(2),
        ),
        if_enum_group(2, COLOR_SPACES_WITH_ALPHA_PARTNER)(
            BoolInput("Output Alpha", default=False),
        ),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                size_as="Input0",
                channels="""
                    if Input2.supportsAlpha and Input3 {
                        4
                    } else {
                        Input2.channels
                    }
                    """,
            ),
            assume_normalized=True,
        )
    ],
)
def change_color_model_node(
    img: np.ndarray, input_: int, output: int, alpha: bool
) -> np.ndarray:
    from_cs = color_space_or_detector_from_id(input_)
    to_cs = color_space_from_id(output)

    alpha_cs = get_alpha_partner(to_cs)
    if alpha and alpha_cs is not None:
        assert alpha_cs.channels == 4
        to_cs = alpha_cs

    return convert(img, from_cs, to_cs)
