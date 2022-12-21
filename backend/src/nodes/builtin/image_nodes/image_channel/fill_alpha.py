from __future__ import annotations

import numpy as np

from . import category as ImageChannelCategory
from ....api.node_base import NodeBase
from ....api.node_factory import NodeFactory
from ....api.inputs import ImageInput, AlphaFillMethodInput, AlphaFillMethod
from ....api.outputs import ImageOutput
from ....api import expression
from ...utils.fill_alpha import (
    convert_to_binary_alpha,
    fill_alpha_fragment_blur,
    fill_alpha_edge_extend,
)


@NodeFactory.register("chainner:image:fill_alpha")
class FillAlphaNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Fills the transparent pixels of an image with nearby colors."
        )
        self.inputs = [
            ImageInput("RGBA", channels=4),
            AlphaFillMethodInput(),
        ]
        self.outputs = [
            ImageOutput(
                "RGB",
                image_type=expression.Image(size_as="Input0"),
                channels=3,
            ),
        ]
        self.category = ImageChannelCategory
        self.name = "Fill Alpha"
        self.icon = "MdOutlineFormatColorFill"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray, method: int) -> np.ndarray:
        """Fills transparent holes in the given image"""

        if method == AlphaFillMethod.EXTEND_TEXTURE:
            # Preprocess to convert the image into binary alpha
            convert_to_binary_alpha(img)
            img = fill_alpha_fragment_blur(img)

            convert_to_binary_alpha(img)
            img = fill_alpha_edge_extend(img, 8)
        elif method == AlphaFillMethod.EXTEND_COLOR:
            convert_to_binary_alpha(img)
            img = fill_alpha_edge_extend(img, 40)
        else:
            assert False, f"Invalid alpha fill method {type(method)} {method}"

        # Finally, add a black background and convert to RGB
        img[:, :, 0] *= img[:, :, 3]
        img[:, :, 1] *= img[:, :, 3]
        img[:, :, 2] *= img[:, :, 3]
        return img[:, :, :3]
