from __future__ import annotations

import cv2
import numpy as np
from enum import Enum
from sanic.log import logger

from . import category as ImageAdjustmentCategory
from ...impl.dithering import (uniform_quantize, ordered_dither, error_diffusion_dither,
                               ThresholdMap, THRESHOLD_MAP_LABELS,
                               ErrorDiffusionMap, ERROR_PROPAGATION_MAP_LABELS)
from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput, EnumInput
from ...properties.outputs import ImageOutput


class UniformDitherAlgorithm(Enum):
    NONE = "None"
    ORDERED = "Ordered"
    DIFFUSION = "Diffusion"


UNIFORM_DITHER_ALGORITHM_LABELS = {
    UniformDitherAlgorithm.NONE: "No dithering",
    UniformDitherAlgorithm.ORDERED: "Ordered Dithering",
    UniformDitherAlgorithm.DIFFUSION: "Error Diffusion",
}


@NodeFactory.register("chainner:image:dither")
class OitherNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply one of a variety of dithering algorithms with a uniform (evenly-spaced) palette."
        self.inputs = [
            ImageInput(),
            NumberInput("Colors per channel", minimum=2, default=8),
            EnumInput(UniformDitherAlgorithm, option_labels=UNIFORM_DITHER_ALGORITHM_LABELS,
                      default_value=UniformDitherAlgorithm.DIFFUSION).with_id(2),

            group(
                "conditional-enum",
                {
                    "enum": 2,
                    "conditions": [UniformDitherAlgorithm.ORDERED.value],
                },
            )(
                EnumInput(
                    ThresholdMap,
                    option_labels=THRESHOLD_MAP_LABELS,
                    default_value=ThresholdMap.BAYER_16).with_id(3),
            ),

            group(
                "conditional-enum",
                {
                    "enum": 2,
                    "conditions": [UniformDitherAlgorithm.DIFFUSION.value],
                },
            )(
                EnumInput(
                    ErrorDiffusionMap,
                    option_labels=ERROR_PROPAGATION_MAP_LABELS,
                    default_value=ErrorDiffusionMap.FLOYD_STEINBERG).with_id(4),
            )

        ]
        self.outputs = [ImageOutput()]
        self.category = ImageAdjustmentCategory
        self.name = "Uniform Dither"
        self.icon = "MdShowChart"
        self.sub = "Adjustments"

    def run(self, img: np.ndarray, num_colors: int,
            dither_algorithm: UniformDitherAlgorithm,
            threshold_map: ThresholdMap,
            error_diffusion_map: ErrorDiffusionMap
            ) -> np.ndarray:
        if dither_algorithm == UniformDitherAlgorithm.NONE:
            return uniform_quantize(img, num_colors=num_colors)
        elif dither_algorithm == UniformDitherAlgorithm.ORDERED:
            return ordered_dither(img, num_colors=num_colors, threshold_map=threshold_map)
        elif dither_algorithm == UniformDitherAlgorithm.DIFFUSION:
            return error_diffusion_dither(img, num_colors=num_colors, error_diffusion_map=error_diffusion_map)


class PaletteDitherAlgorithm(Enum):
    NONE = "None"
    DIFFUSION = "Diffusion"


PALETTE_DITHER_ALGORITHM_LABELS = {
    PaletteDitherAlgorithm.NONE: "No dithering",
    PaletteDitherAlgorithm.DIFFUSION: "Error Diffusion",
}

# @NodeFactory.register("chainner:image:palette_dither")
# class PaletteOitherNode(NodeBase):
#     def __init__(self):
#         super().__init__()
#         self.description = "Apply one of a variety of dithering algorithms with a provided palette.  A palette is just an image with one row where each pixel is a color in the palette."
#         self.inputs = [
#             ImageInput(),
#             ImageInput("Palette"),
#             EnumInput(PaletteDitherAlgorithm, option_labels=PALETTE_DITHER_ALGORITHM_LABELS,
#                       default_value=PaletteDitherAlgorithm.DIFFUSION).with_id(2),
#
#             group(
#                 "conditional-enum",
#                 {
#                     "enum": 2,
#                     "conditions": [PaletteDitherAlgorithm.DIFFUSION.value],
#                 },
#             )(
#                 EnumInput(
#                     ErrorDiffusionMap,
#                     option_labels=ERROR_PROPAGATION_MAP_LABELS,
#                     default_value=ErrorDiffusionMap.FLOYD_STEINBERG).with_id(3),
#             )
#
#         ]
#         self.outputs = [ImageOutput()]
#         self.category = ImageAdjustmentCategory
#         self.name = "Uniform Dither"
#         self.icon = "MdShowChart"
#         self.sub = "Adjustments"
#
#     def run(self, img: np.ndarray, palette: np.ndarray,
#             dither_algorithm: PaletteDitherAlgorithm,
#             error_diffusion_map: ErrorDiffusionMap
#             ) -> np.ndarray:
#         if dither_algorithm == PaletteDitherAlgorithm.NONE:
#             return uniform_quantize(img, palette=palette)
#         elif dither_algorithm == PaletteDitherAlgorithm.DIFFUSION:
#             return error_diffusion_dither(img, palette=palette, error_diffusion_map=error_diffusion_map)
