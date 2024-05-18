from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.groups import if_enum_group
from nodes.impl.image_utils import ShiftFill, shift
from nodes.properties.inputs import (
    EnumInput,
    ImageInput,
    NumberInput,
    SliderInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c, round_half_up

from .. import modification_group


class ShiftCoordMode(Enum):
    RELATIVE = 0
    ABSOLUTE = 1


@modification_group.register(
    schema_id="chainner:image:shift",
    name="Shift",
    description="Shift an image by an x, y amount.",
    icon="BsGraphDown",
    inputs=[
        ImageInput().with_id(0),
        EnumInput(
            ShiftCoordMode, default=ShiftCoordMode.ABSOLUTE, preferred_style="tabs"
        ).with_id(4),
        if_enum_group(4, ShiftCoordMode.RELATIVE)(
            SliderInput("X", min=-100, max=100, default=0, unit="%").with_id(5),
            SliderInput("Y", min=-100, max=100, default=0, unit="%").with_id(6),
        ),
        if_enum_group(4, ShiftCoordMode.ABSOLUTE)(
            NumberInput("X", min=None, unit="px").with_id(1),
            NumberInput("Y", min=None, unit="px").with_id(2),
        ),
        EnumInput(
            ShiftFill,
            label="Negative Space Fill",
            default=ShiftFill.AUTO,
            option_labels={
                ShiftFill.WRAP: "Wrap (Tile)",
            },
        ).with_id(3),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let i = Input0;
                let fill = Input3;
                match fill {
                    ShiftFill::Transparent => Image { width: i.width, height: i.height, channels: 4 },
                    _ => i,
                }
            """,
            assume_normalized=True,
        )
    ],
)
def shift_node(
    img: np.ndarray,
    mode: ShiftCoordMode,
    rel_x: int,
    rel_y: int,
    abs_x: int,
    abs_y: int,
    fill: ShiftFill,
) -> np.ndarray:
    h, w, _ = get_h_w_c(img)

    if mode == ShiftCoordMode.RELATIVE:
        abs_x = round_half_up(w * rel_x / 100)
        abs_y = round_half_up(h * rel_y / 100)

    return shift(img, abs_x, abs_y, fill)
