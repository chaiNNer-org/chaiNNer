from __future__ import annotations

from enum import Enum

import numpy as np

from api import KeyInfo
from nodes.groups import if_enum_group
from nodes.impl.color.color import Color
from nodes.impl.image_utils import BorderType, create_border
from nodes.properties.inputs import (
    BorderInput,
    ColorInput,
    EnumInput,
    ImageInput,
    NumberInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import Padding, get_h_w_c

from .. import padding_group


class BorderMode(Enum):
    BORDER = 0
    EDGES = 1
    OFFSETS = 2


@padding_group.register(
    schema_id="chainner:image:pad",
    name="Pad",
    description=[
        "Adds padding to an image.",
        "This node can be used to add a border or edges to an image.",
    ],
    icon="BsBorderOuter",
    inputs=[
        ImageInput(),
        BorderInput().with_id(1),
        if_enum_group(1, BorderType.CUSTOM_COLOR)(
            ColorInput().with_id(2),
        ),
        EnumInput(
            BorderMode, default=BorderMode.BORDER, preferred_style="tabs"
        ).with_id(3),
        if_enum_group(3, BorderMode.BORDER)(
            NumberInput("Amount", unit="px").with_id(4),
        ),
        if_enum_group(3, (BorderMode.EDGES, BorderMode.OFFSETS))(
            NumberInput("Left", unit="px").with_id(5),
            NumberInput("Top", unit="px").with_id(6),
        ),
        if_enum_group(3, BorderMode.EDGES)(
            NumberInput("Right", unit="px").with_id(7),
            NumberInput("Bottom", unit="px").with_id(8),
        ),
        if_enum_group(3, BorderMode.OFFSETS)(
            NumberInput("Width", unit="px", minimum=1, default=100).with_id(9),
            NumberInput("Height", unit="px", minimum=1, default=100).with_id(10),
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let i = Input0;

                let border = Input1;
                let color = Input2;

                let amount = Input4;
                let left = Input5;
                let top = Input6;
                let right = Input7;
                let bottom = Input8;
                let width = Input9;
                let height = Input10;

                let size = match Input3 {
                    BorderMode::Border => Image {
                        width: i.width + amount * 2,
                        height: i.height + amount * 2,
                    },
                    BorderMode::Edges => Image {
                        width: i.width + left + right,
                        height: i.height + top + bottom,
                    },
                    BorderMode::Offsets => Image {
                        width,
                        height,
                    },
                };

                size & Image { channels: BorderType::getOutputChannels(border, i.channels, color) }
            """,
            assume_normalized=True,
        )
    ],
    key_info=KeyInfo.enum(3),
)
def pad_node(
    img: np.ndarray,
    border_type: BorderType,
    color: Color,
    border_mode: BorderMode,
    amount: int,
    left: int,
    top: int,
    right: int,
    bottom: int,
    width: int,
    height: int,
) -> np.ndarray:
    if border_mode == BorderMode.BORDER:
        return create_border(img, border_type, Padding.all(amount), color=color)
    elif border_mode == BorderMode.EDGES:
        return create_border(
            img, border_type, Padding(top, right, bottom, left), color=color
        )
    elif border_mode == BorderMode.OFFSETS:
        h, w, _ = get_h_w_c(img)
        r = width - left - w
        b = height - top - h
        padded = create_border(
            img, border_type, Padding(top, max(0, r), max(0, b), left), color=color
        )
        if r < 0 or b < 0:
            # copy, so we don't keep a reference to the underlying array
            padded = padded[:height, :width, ...].copy()
        return padded
