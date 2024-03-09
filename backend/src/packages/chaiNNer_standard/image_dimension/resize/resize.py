from __future__ import annotations

from enum import Enum

import numpy as np

from api import KeyInfo
from nodes.groups import Condition, if_enum_group, if_group
from nodes.impl.resize import ResizeFilter, resize
from nodes.properties.inputs import (
    BoolInput,
    EnumInput,
    ImageInput,
    NumberInput,
    ResizeFilterInput,
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
                label_style="hidden",
            ).with_id(2),
        ),
        if_enum_group(1, ImageResizeMode.ABSOLUTE)(
            NumberInput("Width", minimum=1, default=1, unit="px").with_id(3),
            NumberInput("Height", minimum=1, default=1, unit="px").with_id(4),
        ),
        ResizeFilterInput().with_id(5),
        if_group(Condition.type(0, "Image { channels: 4 } "))(
            BoolInput("Separate Alpha", default=False)
            .with_docs(
                "Resize alpha separately from color. Enable this option if the alpha channel of the image is **not** transparency.",
                "To resize images with transparency correctly, the alpha channels must be multiplied with the color channels before resizing. While this will produce correct color values, it will also set the color of fully transparent pixels to black. This is an issue if the alpha channel isn't transparency. E.g. games often use the alpha channel of textures for other purposes, such as height maps or edge maps. For such images, the alpha channel has to be resized separately or else it will corrupt the color channels.",
                "For images where the alpha channel is transparency (most transparent images), this option should be **disabled**.",
                hint=True,
            )
            .with_id(6)
        ),
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
    key_info=KeyInfo.type(
        """
        let mode = Input1;

        let scale = Input2;
        let width = Input3;
        let height = Input4;

        match mode {
            ImageResizeMode::Percentage => string::concat(toString(scale), "%"),
            ImageResizeMode::Absolute => string::concat(toString(width), "x", toString(height)),
        }
        """
    ),
)
def resize_node(
    img: np.ndarray,
    mode: ImageResizeMode,
    scale: float,
    width: int,
    height: int,
    filter: ResizeFilter,
    separate_alpha: bool,
) -> np.ndarray:
    h, w, _ = get_h_w_c(img)

    out_dims: tuple[int, int]
    if mode == ImageResizeMode.PERCENTAGE:
        out_dims = (
            max(round_half_up(w * (scale / 100)), 1),
            max(round_half_up(h * (scale / 100)), 1),
        )
    else:
        out_dims = (width, height)

    return resize(
        img,
        out_dims,
        filter,
        separate_alpha=separate_alpha,
        gamma_correction=False,
    )
