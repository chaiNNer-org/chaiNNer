from __future__ import annotations

from enum import Enum

import numpy as np

import navi
from nodes.groups import if_enum_group
from nodes.impl.dithering.palette import (
    distinct_colors_palette,
    kmeans_palette,
    median_cut_palette,
)
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


class PaletteExtractionMethod(Enum):
    ALL = "all"
    KMEANS = "k-means"
    MEDIAN_CUT = "median"


PALETTE_EXTRACTION_METHOD_LABELS = {
    PaletteExtractionMethod.ALL: "所有不同的颜色",
    PaletteExtractionMethod.KMEANS: "K均值",
    PaletteExtractionMethod.MEDIAN_CUT: "中值切割",
}

MAX_COLORS = 4096


@miscellaneous_group.register(
    schema_id="chainner:image:palette_from_image",
    name="从图像生成调色板",
    description=[
        "使用图像创建一个调色板。",
        "调色板作为一行图像返回（高度=1）。调色板的所有颜色都在图像的顶行。",
        f'*注意：*“{PALETTE_EXTRACTION_METHOD_LABELS[PaletteExtractionMethod.ALL]}”选项仅支持最多具有{MAX_COLORS}种不同颜色的图像。如果图像具有更多颜色，将会出现错误。',
    ],
    see_also=[
        "chainner:image:lut",
        "chainner:image:palette_dither",
    ],
    icon="MdGradient",
    inputs=[
        ImageInput(),
        EnumInput(
            PaletteExtractionMethod,
            option_labels=PALETTE_EXTRACTION_METHOD_LABELS,
            default=PaletteExtractionMethod.KMEANS,
        ).with_id(1),
        if_enum_group(
            1,
            (PaletteExtractionMethod.KMEANS, PaletteExtractionMethod.MEDIAN_CUT),
        )(
            NumberInput(
                "调色板大小", minimum=2, maximum=MAX_COLORS, default=8
            ).with_id(2),
        ),
    ],
    outputs=[
        ImageOutput(
            "调色板",
            image_type=navi.Image(
                width="""
                    min(
                        match Input1 {
                            PaletteExtractionMethod::All => int(1..),
                            _ => Input2
                        },
                        MAX_COLORS
                    )
                """.replace("MAX_COLORS", str(MAX_COLORS)),
                height=1,
                channels_as="Input0",
            ),
        )
    ],
)
def palette_from_image_node(
    img: np.ndarray,
    palette_extraction_method: PaletteExtractionMethod,
    palette_size: int,
) -> np.ndarray:
    distinct_colors = distinct_colors_palette(img)
    distinct_count = distinct_colors.shape[1]

    if palette_extraction_method == PaletteExtractionMethod.ALL:
        if distinct_count > MAX_COLORS:
            raise ValueError(
                f"图像具有{distinct_count}种不同的颜色，但只支持最多{MAX_COLORS}种颜色的调色板。"
            )
        return distinct_colors

    if palette_size >= distinct_count:
        excess = palette_size - distinct_count
        return np.pad(distinct_colors, [(0, 0), (0, excess), (0, 0)], mode="edge")  # type: ignore

    if palette_extraction_method == PaletteExtractionMethod.KMEANS:
        return kmeans_palette(img, palette_size)
    elif palette_extraction_method == PaletteExtractionMethod.MEDIAN_CUT:
        return median_cut_palette(img, palette_size)
