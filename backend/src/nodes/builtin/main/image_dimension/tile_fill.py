from __future__ import annotations

import numpy as np

from . import category as ImageDimensionCategory
from ....api.node_base import NodeBase
from ....api.node_factory import NodeFactory
from ....api.inputs import ImageInput, NumberInput, TileModeInput
from ....api.outputs import ImageOutput
from ....api import expression
from ...utils.tile_util import tile_image


@NodeFactory.register("chainner:image:tile_fill")
class TileFillNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Tiles an image to an exact resolution."
        self.inputs = [
            ImageInput(),
            NumberInput("Width", minimum=1, default=1, unit="px"),
            NumberInput("Height", minimum=1, default=1, unit="px"),
            TileModeInput(),
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
        self, img: np.ndarray, width: int, height: int, tile_mode: int
    ) -> np.ndarray:
        return tile_image(img, width, height, tile_mode)
