from __future__ import annotations

import numpy as np

from ...impl.tile import TileMode, tile_image
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import EnumInput, ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from . import category as ImageDimensionCategory


@NodeFactory.register("chainner:image:tile_fill")
class TileFillNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Tiles an image to an exact resolution."
        self.inputs = [
            ImageInput(),
            NumberInput("Width", minimum=1, default=1, unit="px"),
            NumberInput("Height", minimum=1, default=1, unit="px"),
            EnumInput(TileMode),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input1",
                    height="Input2",
                    channels="Input0.channels",
                )
            )
        ]
        self.category = ImageDimensionCategory
        self.name = "Tile Fill"
        self.icon = "MdWindow"
        self.sub = "Resize"

    def run(
        self, img: np.ndarray, width: int, height: int, tile_mode: TileMode
    ) -> np.ndarray:
        return tile_image(img, width, height, tile_mode)
