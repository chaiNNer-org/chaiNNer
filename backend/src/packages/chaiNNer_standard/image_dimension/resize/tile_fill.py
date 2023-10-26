from __future__ import annotations

import navi
import numpy as np
from nodes.impl.tile import TileMode, tile_image
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import resize_group


@resize_group.register(
    schema_id="chainner:image:tile_fill",
    name="Tile Fill",
    description="Tiles an image to an exact resolution.",
    icon="MdWindow",
    inputs=[
        ImageInput(),
        NumberInput("Width", minimum=1, default=1, unit="px"),
        NumberInput("Height", minimum=1, default=1, unit="px"),
        EnumInput(TileMode),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                width="Input1",
                height="Input2",
                channels="Input0.channels",
            ),
            assume_normalized=True,
        )
    ],
)
def tile_fill_node(
    img: np.ndarray, width: int, height: int, tile_mode: TileMode
) -> np.ndarray:
    return tile_image(img, width, height, tile_mode)
