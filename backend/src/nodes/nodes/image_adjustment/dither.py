from __future__ import annotations

from enum import Enum

import numpy as np

from . import category as ImageAdjustmentCategory
from ...impl.dithering.color_distance import batch_manhattan_color_distance, ColorDistanceFunction, \
    COLOR_DISTANCE_FUNCTION_LABELS
from ...impl.dithering.diffusion import uniform_error_diffusion_dither, ErrorDiffusionMap, ERROR_PROPAGATION_MAP_LABELS, \
    nearest_color_error_diffusion_dither
from ...impl.dithering.ordered import ThresholdMap, THRESHOLD_MAP_LABELS, ordered_dither
from ...impl.dithering.palette import distinct_colors
from ...impl.dithering.quantize import nearest_color_quantize, uniform_quantize
from ...impl.dithering.riemersma import riemersma_dither, nearest_color_riemersma_dither
from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import ImageInput, NumberInput, EnumInput, SliderInput
from ...properties.outputs import ImageOutput


class UniformDitherAlgorithm(Enum):
    NONE = "None"
    ORDERED = "Ordered"
    DIFFUSION = "Diffusion"
    RIEMERSMA = "Riemersma"


UNIFORM_DITHER_ALGORITHM_LABELS = {
    UniformDitherAlgorithm.NONE: "No dithering",
    UniformDitherAlgorithm.ORDERED: "Ordered Dithering",
    UniformDitherAlgorithm.DIFFUSION: "Error Diffusion",
    UniformDitherAlgorithm.RIEMERSMA: "Riemersma Dithering",
}


@NodeFactory.register("chainner:image:dither")
class DitherNode(NodeBase):
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
                    "conditions": [UniformDitherAlgorithm.ORDERED.value,
                                   UniformDitherAlgorithm.DIFFUSION.value,
                                   UniformDitherAlgorithm.RIEMERSMA.value],
                },
            )(
                EnumInput(
                    ThresholdMap,
                    option_labels=THRESHOLD_MAP_LABELS,
                    default_value=ThresholdMap.BAYER_16).with_id(3),
                EnumInput(
                    ErrorDiffusionMap,
                    option_labels=ERROR_PROPAGATION_MAP_LABELS,
                    default_value=ErrorDiffusionMap.FLOYD_STEINBERG).with_id(4),
                NumberInput(
                    "History Length",
                    minimum=2,
                    default=16,
                ).with_id(5),
            )
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageAdjustmentCategory
        self.name = "Dither"
        self.icon = "MdShowChart"
        self.sub = "Adjustments"

    def run(self, img: np.ndarray, num_colors: int,
            dither_algorithm: UniformDitherAlgorithm,
            threshold_map: ThresholdMap,
            error_diffusion_map: ErrorDiffusionMap,
            history_length: int,
            ) -> np.ndarray:
        if dither_algorithm == UniformDitherAlgorithm.NONE:
            return uniform_quantize(img, num_colors=num_colors)
        elif dither_algorithm == UniformDitherAlgorithm.ORDERED:
            return ordered_dither(img, num_colors=num_colors, threshold_map=threshold_map)
        elif dither_algorithm == UniformDitherAlgorithm.DIFFUSION:
            return uniform_error_diffusion_dither(img, num_colors=num_colors, error_diffusion_map=error_diffusion_map)
        elif dither_algorithm == UniformDitherAlgorithm.RIEMERSMA:
            return riemersma_dither(img, num_colors=num_colors, history_length=history_length,
                                    decay_ratio=1 / history_length)


class PaletteDitherAlgorithm(Enum):
    NONE = "None"
    DIFFUSION = "Diffusion"
    RIEMERSMA = "Riemersma"


PALETTE_DITHER_ALGORITHM_LABELS = {
    PaletteDitherAlgorithm.NONE: "No dithering",
    PaletteDitherAlgorithm.DIFFUSION: "Error Diffusion",
    PaletteDitherAlgorithm.RIEMERSMA: "Riemersma Dithering",
}


@NodeFactory.register("chainner:image:palette_dither")
class PaletteDitherNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply one of a variety of dithering algorithms using colors from a given palette. (Only the top row of pixels (y=0) of the palette will be used.)"
        self.inputs = [
            ImageInput(),
            ImageInput(label="LUT", image_type=expression.Image(channels_as="Input0")),
            EnumInput(ColorDistanceFunction, option_labels=COLOR_DISTANCE_FUNCTION_LABELS,
                      default_value=ColorDistanceFunction.EUCLIDEAN).with_id(2),
            EnumInput(PaletteDitherAlgorithm, option_labels=PALETTE_DITHER_ALGORITHM_LABELS,
                      default_value=PaletteDitherAlgorithm.DIFFUSION).with_id(3),

            group(
                "conditional-enum",
                {
                    "enum": 3,
                    "conditions": [PaletteDitherAlgorithm.DIFFUSION.value,
                                   PaletteDitherAlgorithm.RIEMERSMA.value],
                },
            )(
                EnumInput(
                    ErrorDiffusionMap,
                    option_labels=ERROR_PROPAGATION_MAP_LABELS,
                    default_value=ErrorDiffusionMap.FLOYD_STEINBERG).with_id(4),
                NumberInput(
                    "History Length",
                    minimum=2,
                    default=16,
                ).with_id(5),
            )
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageAdjustmentCategory
        self.name = "Dither (Palette)"
        self.icon = "MdShowChart"
        self.sub = "Adjustments"

    def run(self, img: np.ndarray, palette: np.ndarray,
            color_distance_function: ColorDistanceFunction,
            dither_algorithm: PaletteDitherAlgorithm,
            error_diffusion_map: ErrorDiffusionMap,
            history_length: int,
            ) -> np.ndarray:
        if dither_algorithm == PaletteDitherAlgorithm.NONE:
            return nearest_color_quantize(img, palette=palette, color_distance_function=color_distance_function)
        elif dither_algorithm == PaletteDitherAlgorithm.DIFFUSION:
            return nearest_color_error_diffusion_dither(img, palette=palette,
                                                        color_distance_function=color_distance_function,
                                                        error_diffusion_map=error_diffusion_map)
        elif dither_algorithm == PaletteDitherAlgorithm.RIEMERSMA:
            return nearest_color_riemersma_dither(img, palette, color_distance_function=color_distance_function,
                                                  history_length=history_length,
                                                  decay_ratio=1 / history_length)


@NodeFactory.register("chainner:image:palette_from_image")
class PaletteFromImage(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Create a palette from all the distinct colors in an image."
        self.inputs = [ImageInput()]
        self.outputs = [ImageOutput(image_type=expression.Image(channels_as="Input0"))]
        self.category = ImageAdjustmentCategory
        self.name = "Palette from Image"
        self.icon = "MdShowChart"
        self.sub = "Adjustments"

    def run(self, img: np.ndarray) -> np.ndarray:
        return distinct_colors(img)