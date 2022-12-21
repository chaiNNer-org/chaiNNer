from __future__ import annotations

import numpy as np

from . import category as ImageUtilityCategory
from ....api.node_base import NodeBase, group
from ....api.node_factory import NodeFactory
from ....api.inputs import (
    ImageInput,
    ColorSpaceInput,
)
from ....api.outputs import ImageOutput
from ....api import expression
from ...utils.color.convert import (
    convert,
    color_space_from_id,
    color_space_or_detector_from_id,
)


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
                ColorSpaceInput(label="From", detector=True),
                ColorSpaceInput(label="To"),
            ),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    size_as="Input0",
                    channels="Input2.channels",
                )
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Change Colorspace"
        self.icon = "MdColorLens"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray, input_: int, output: int) -> np.ndarray:
        """Takes an image and changes the color mode it"""

        return convert(
            img,
            color_space_or_detector_from_id(input_),
            color_space_from_id(output),
        )
