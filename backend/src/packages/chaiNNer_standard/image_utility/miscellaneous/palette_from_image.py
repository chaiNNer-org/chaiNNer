from __future__ import annotations

from enum import Enum

import navi
import numpy as np
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
    PaletteExtractionMethod.ALL: "All distinct colors",
    PaletteExtractionMethod.KMEANS: "K-Means",
    PaletteExtractionMethod.MEDIAN_CUT: "Median cut",
}

MAX_COLORS = 4096


@miscellaneous_group.register(
    schema_id="chainner:image:palette_from_image",
    name="Palette from Image",
    description=[
        "Use an image to create a color palette.",
        "The color palette is returned as an image with one row (height=1). All colors of the palette are in the top row of the image.",
        f'*Note:* The "{PALETTE_EXTRACTION_METHOD_LABELS[PaletteExtractionMethod.ALL]}" option only supports images with at most {MAX_COLORS} distinct colors. If the image has more colors, an error will occur.',
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
                "Palette Size", minimum=2, maximum=MAX_COLORS, default=8
            ).with_id(2),
        ),
    ],
    outputs=[
        ImageOutput(
            "Palette",
            image_type=navi.Image(
                width="""
                    min(
                        match Input1 {
                            PaletteExtractionMethod::All => int(1..),
                            _ => Input2
                        },
                        MAX_COLORS
                    )
                """.replace(
                    "MAX_COLORS", str(MAX_COLORS)
                ),
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
                f"Image has {distinct_count} distinct colors, but only palettes with at most {MAX_COLORS} colors are supported."
            )
        return distinct_colors

    if palette_size >= distinct_count:
        excess = palette_size - distinct_count
        return np.pad(distinct_colors, [(0, 0), (0, excess), (0, 0)], mode="edge")  # type: ignore

    if palette_extraction_method == PaletteExtractionMethod.KMEANS:
        return kmeans_palette(img, palette_size)
    elif palette_extraction_method == PaletteExtractionMethod.MEDIAN_CUT:
        return median_cut_palette(img, palette_size)
