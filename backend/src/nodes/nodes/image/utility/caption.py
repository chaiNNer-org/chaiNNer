from __future__ import annotations

import numpy as np

from ....categories import ImageUtilityCategory
from ....node_base import NodeBase
from ....node_factory import NodeFactory
from ....properties.inputs import (
    ImageInput,
    TextInput,
    NumberInput,
    CaptionPositionInput,
)
from ....properties.outputs import ImageOutput
from ....utils.pil_utils import add_caption


@NodeFactory.register("chainner:image:caption")
class CaptionNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Add a caption to the bottom of an image."
        self.inputs = [
            ImageInput(),
            TextInput("Caption"),
            NumberInput("Caption Size", minimum=20, default=42, unit="px"),
            CaptionPositionInput(),
        ]
        self.outputs = [
            ImageOutput(
                image_type="""
                // this value is defined by `add_caption`
                let captionHeight = Input2;
                Image {
                    width: Input0.width,
                    height: Input0.height + captionHeight,
                    channels: Input0.channels,
                }
                """
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Add Caption"
        self.icon = "MdVideoLabel"
        self.sub = "Compositing"

    def run(
        self, img: np.ndarray, caption: str, size: int, position: str
    ) -> np.ndarray:
        """Add caption an image"""

        return add_caption(img, caption, size, position)
