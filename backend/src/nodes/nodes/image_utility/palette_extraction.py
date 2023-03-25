from __future__ import annotations

from enum import Enum

import numpy as np

from ...groups import if_enum_group
from ...impl.dithering.palette import (
    distinct_colors_palette,
    kmeans_palette,
    median_cut_palette,
)
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import EnumInput, ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from . import category as ImageUtilityCategory


class PaletteExtractionMethod(Enum):
    ALL = "all"
    KMEANS = "k-means"
    MEDIAN_CUT = "median"


PALETTE_EXTRACTION_METHOD_LABELS = {
    PaletteExtractionMethod.ALL: "All distinct colors",
    PaletteExtractionMethod.KMEANS: "K-Means",
    PaletteExtractionMethod.MEDIAN_CUT: "Median cut",
}


@NodeFactory.register("chainner:image:palette_from_image")
class PaletteFromImage(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Use an image to create a palette.  A palette is an image with one row."
        )
        self.inputs = [
            ImageInput(),
            EnumInput(
                PaletteExtractionMethod,
                option_labels=PALETTE_EXTRACTION_METHOD_LABELS,
                default_value=PaletteExtractionMethod.KMEANS,
            ).with_id(1),
            if_enum_group(
                1,
                (PaletteExtractionMethod.KMEANS, PaletteExtractionMethod.MEDIAN_CUT),
            )(
                NumberInput("Palette Size", minimum=2, default=8).with_id(2),
            ),
        ]
        self.outputs = [
            ImageOutput(
                "Palette",
                image_type=expression.Image(
                    width="""
                match Input1 {
                    PaletteExtractionMethod::All => int(1..),
                    _ => Input2
                }
            """,
                    height=1,
                    channels_as="Input0",
                ),
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Palette from Image"
        self.icon = "MdGradient"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        palette_extraction_method: PaletteExtractionMethod,
        palette_size: int,
    ) -> np.ndarray:
        distinct_colors = distinct_colors_palette(img)

        if palette_extraction_method == PaletteExtractionMethod.ALL:
            return distinct_colors

        if palette_size > distinct_colors.shape[1]:
            excess = palette_size - distinct_colors.shape[1]
            return np.pad(distinct_colors, [(0, 0), (0, excess), (0, 0)], mode="edge")  # type: ignore

        if palette_extraction_method == PaletteExtractionMethod.KMEANS:
            return kmeans_palette(img, palette_size)
        elif palette_extraction_method == PaletteExtractionMethod.MEDIAN_CUT:
            if palette_size > distinct_colors.shape[1]:
                return distinct_colors
            return median_cut_palette(img, palette_size)
