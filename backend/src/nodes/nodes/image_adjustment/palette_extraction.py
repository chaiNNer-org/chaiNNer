from __future__ import annotations

from enum import Enum

import numpy as np

from . import category as ImageAdjustmentCategory
from ...impl.dithering.palette import distinct_colors, kmeans_palette, median_cut
from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import ImageInput, EnumInput, NumberInput
from ...properties.outputs import ImageOutput


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
        self.description = "Use an image to create a palette.  A palette is an image with one row, which can be used in nodes that ask for a LUT."
        self.inputs = [
            ImageInput(),
            EnumInput(
                PaletteExtractionMethod,
                option_labels=PALETTE_EXTRACTION_METHOD_LABELS,
                default_value=PaletteExtractionMethod.KMEANS,
            ).with_id(1),
            group(
                "conditional-enum",
                {
                    "enum": 1,
                    "conditions": [
                        [
                            PaletteExtractionMethod.KMEANS.value,
                            PaletteExtractionMethod.MEDIAN_CUT.value,
                        ]
                    ],
                },
            )(
                NumberInput(
                    "Palette Size",
                    minimum=2,
                    default=8,
                ).with_id(2),
            ),
        ]
        self.outputs = [ImageOutput(image_type=expression.Image(channels_as="Input0"))]
        self.category = ImageAdjustmentCategory
        self.name = "Palette from Image"
        self.icon = "MdShowChart"
        self.sub = "Adjustments"

    def run(
        self,
        img: np.ndarray,
        palette_extraction_method: PaletteExtractionMethod,
        palette_size: int,
    ) -> np.ndarray:
        if palette_extraction_method == PaletteExtractionMethod.ALL:
            return distinct_colors(img)
        elif palette_extraction_method == PaletteExtractionMethod.KMEANS:
            return kmeans_palette(img, palette_size)
        elif palette_extraction_method == PaletteExtractionMethod.MEDIAN_CUT:
            return median_cut(img, palette_size)
