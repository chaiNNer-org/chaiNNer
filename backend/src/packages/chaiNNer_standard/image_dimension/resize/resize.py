from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.groups import if_enum_group
from nodes.impl.pil_utils import InterpolationMethod, resize
from nodes.properties.inputs import (
    EnumInput,
    ImageInput,
    InterpolationInput,
    NumberInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c, round_half_up

from .. import resize_group


class ImageResizeMode(Enum):
    PERCENTAGE = 0
    ABSOLUTE = 1


@resize_group.register(
    schema_id="chainner:image:resize",
    name="Resize",
    description=[
        "Resize an image by a percent scale factor or absolute dimensions.",
        "Auto uses box for downsampling and lanczos for upsampling.",
    ],
    icon="MdOutlinePhotoSizeSelectLarge",
    inputs=[
        ImageInput(),
        EnumInput(
            ImageResizeMode, default=ImageResizeMode.PERCENTAGE, preferred_style="tabs"
        ).with_id(1),
        if_enum_group(1, ImageResizeMode.PERCENTAGE)(
            NumberInput(
                "Percentage",
                precision=4,
                controls_step=25.0,
                default=100.0,
                unit="%",
                hide_label=True,
            ).with_id(2),
        ),
        if_enum_group(1, ImageResizeMode.ABSOLUTE)(
            NumberInput("Width", minimum=1, default=1, unit="px").with_id(3),
            NumberInput("Height", minimum=1, default=1, unit="px").with_id(4),
        ),
        InterpolationInput().with_id(5),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let i = Input0;
                let mode = Input1;

                let scale = Input2;
                let width = Input3;
                let height = Input4;

                match mode {
                    ImageResizeMode::Percentage => Image {
                        width: max(1, int & round(i.width * scale / 100)),
                        height: max(1, int & round(i.height * scale / 100)),
                        channels: i.channels,
                    },
                    ImageResizeMode::Absolute => Image {
                        width: width,
                        height: height,
                        channels: i.channels,
                    },
                }
            """,
            assume_normalized=True,
        )
    ],
    limited_to_8bpc=True,
)
def resize_node(
    img: np.ndarray,
    mode: ImageResizeMode,
    scale: float,
    width: int,
    height: int,
    interpolation: InterpolationMethod,
) -> np.ndarray:
    h, w, c = get_h_w_c(img)

    out_dims: tuple[int, int]
    if mode == ImageResizeMode.PERCENTAGE:
        out_dims = (
            max(round_half_up(w * (scale / 100)), 1),
            max(round_half_up(h * (scale / 100)), 1),
        )
    else:
        out_dims = (width, height)

    # check that the output image fits into memory
    out_bytes = out_dims[0] * out_dims[1] * c * 4
    assert (
        out_bytes < 16 * 2**30
    ), f"Output image is too large ({out_bytes} bytes). Only images up to 16 GB are allowed."

    return resize(img, out_dims, interpolation)
