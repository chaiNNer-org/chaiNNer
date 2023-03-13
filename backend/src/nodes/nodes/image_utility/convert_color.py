from __future__ import annotations

import numpy as np

from ...group import group
from ...groups import if_enum_group
from ...impl.color.convert import (
    color_space_from_id,
    color_space_or_detector_from_id,
    convert,
)
from ...impl.color.convert_data import color_spaces, get_alpha_partner
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import (
    BoolInput,
    ColorSpaceDetectorInput,
    ColorSpaceInput,
    ImageInput,
)
from ...properties.outputs import ImageOutput
from . import category as ImageUtilityCategory

COLOR_SPACES_WITH_ALPHA_PARTNER = [
    c.id for c in color_spaces if get_alpha_partner(c) is not None
]


@NodeFactory.register("chainner:image:change_colorspace")
class ColorConvertNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Convert the colorspace of an image to a different one. "
            "Also can convert to different channel-spaces."
        )
        self.inputs = [
            ImageInput(image_type=expression.Image(channels="Input1.channels")),
            group("from-to-dropdowns")(
                ColorSpaceDetectorInput(label="From").with_id(1),
                ColorSpaceInput(label="To").with_id(2),
            ),
            if_enum_group(2, COLOR_SPACES_WITH_ALPHA_PARTNER)(
                BoolInput("Output Alpha", default=False),
            ),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    size_as="Input0",
                    channels="""
                    if bool::and(Input2.supportsAlpha, Input3) {
                        4
                    } else {
                        Input2.channels
                    }
                    """,
                )
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Change Colorspace"
        self.icon = "MdColorLens"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray, input_: int, output: int, alpha: bool) -> np.ndarray:
        """Takes an image and changes the color mode it"""

        from_cs = color_space_or_detector_from_id(input_)
        to_cs = color_space_from_id(output)

        alpha_cs = get_alpha_partner(to_cs)
        if alpha and alpha_cs is not None:
            assert alpha_cs.channels == 4
            to_cs = alpha_cs

        return convert(img, from_cs, to_cs)
