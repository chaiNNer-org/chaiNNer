from __future__ import annotations

from enum import Enum

import numpy as np

from api import KeyInfo
from nodes.groups import if_enum_group
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import crop_group


class CropMode(Enum):
    BORDER = 0
    EDGES = 1
    OFFSETS = 2


@crop_group.register(
    schema_id="chainner:image:crop",
    name="Crop",
    description="Crop an image.",
    icon="MdCrop",
    inputs=[
        ImageInput(),
        EnumInput(CropMode, default=CropMode.BORDER, preferred_style="tabs").with_id(1),
        if_enum_group(1, CropMode.BORDER)(
            NumberInput("Amount", unit="px").with_id(2),
        ),
        if_enum_group(1, (CropMode.EDGES, CropMode.OFFSETS))(
            NumberInput("Left", unit="px").with_id(4),
            NumberInput("Top", unit="px").with_id(3),
        ),
        if_enum_group(1, CropMode.EDGES)(
            NumberInput("Right", unit="px").with_id(6),
            NumberInput("Bottom", unit="px").with_id(5),
        ),
        if_enum_group(1, CropMode.OFFSETS)(
            NumberInput("Width", unit="px", min=1, default=100).with_id(8),
            NumberInput("Height", unit="px", min=1, default=100).with_id(7),
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let i = Input0;

                let amount = Input2;
                let top = Input3;
                let left = Input4;
                let bottom = Input5;
                let right = Input6;
                let height = Input7;
                let width = Input8;

                let size = match Input1 {
                    CropMode::Border => Image {
                        width: (i.width - amount * 2) & int(1..),
                        height: (i.height - amount * 2) & int(1..),
                    },
                    CropMode::Edges => Image {
                        width: (i.width - (left + right)) & int(1..),
                        height: (i.height - (top + bottom)) & int(1..),
                    },
                    CropMode::Offsets => Image {
                        width: min(width, i.width - left) & int(1..),
                        height: min(height, i.height - top) & int(1..),
                    },
                };

                size & Image { channels: i.channels }
            """,
            assume_normalized=True,
        ).with_never_reason(
            "The cropped area would result in an image with no width or no height."
        )
    ],
    key_info=KeyInfo.enum(1),
)
def crop_node(
    img: np.ndarray,
    mode: CropMode,
    amount: int,
    left: int,
    top: int,
    right: int,
    bottom: int,
    width: int,
    height: int,
) -> np.ndarray:
    h, w, _ = get_h_w_c(img)

    if mode == CropMode.BORDER:
        if amount == 0:
            return img

        assert 2 * amount < h, "Cropped area would result in an image with no height"
        assert 2 * amount < w, "Cropped area would result in an image with no width"

        return img[amount : h - amount, amount : w - amount]
    elif mode == CropMode.EDGES:
        if top == bottom == left == right == 0:
            return img

        assert top + bottom < h, "Cropped area would result in an image with no height"
        assert left + right < w, "Cropped area would result in an image with no width"

        return img[top : h - bottom, left : w - right]
    elif mode == CropMode.OFFSETS:
        assert top < h, "Cropped area would result in an image with no height"
        assert left < w, "Cropped area would result in an image with no width"

        return img[top : top + height, left : left + width]
