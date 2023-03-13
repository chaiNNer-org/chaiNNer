from __future__ import annotations

from enum import Enum

import numpy as np

from ...groups import if_enum_group
from ...impl.dithering.color_distance import batch_nearest_uniform_color
from ...impl.dithering.constants import (
    ERROR_PROPAGATION_MAP_LABELS,
    THRESHOLD_MAP_LABELS,
    ErrorDiffusionMap,
    ThresholdMap,
)
from ...impl.dithering.diffusion import uniform_error_diffusion_dither
from ...impl.dithering.ordered import ordered_dither
from ...impl.dithering.riemersma import uniform_riemersma_dither
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import EnumInput, ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from . import category as ImageFilterCategory


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
            EnumInput(
                UniformDitherAlgorithm,
                option_labels=UNIFORM_DITHER_ALGORITHM_LABELS,
                default_value=UniformDitherAlgorithm.DIFFUSION,
            ).with_id(2),
            if_enum_group(2, UniformDitherAlgorithm.ORDERED)(
                EnumInput(
                    ThresholdMap,
                    option_labels=THRESHOLD_MAP_LABELS,
                    default_value=ThresholdMap.BAYER_16,
                ).with_id(3),
            ),
            if_enum_group(2, UniformDitherAlgorithm.DIFFUSION)(
                EnumInput(
                    ErrorDiffusionMap,
                    option_labels=ERROR_PROPAGATION_MAP_LABELS,
                    default_value=ErrorDiffusionMap.FLOYD_STEINBERG,
                ).with_id(4),
            ),
            if_enum_group(2, UniformDitherAlgorithm.RIEMERSMA)(
                NumberInput(
                    "History Length",
                    minimum=2,
                    default=16,
                ).with_id(5),
            ),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Dither"
        self.icon = "MdShowChart"
        self.sub = "Quantize"

    def run(
        self,
        img: np.ndarray,
        num_colors: int,
        dither_algorithm: UniformDitherAlgorithm,
        threshold_map: ThresholdMap,
        error_diffusion_map: ErrorDiffusionMap,
        history_length: int,
    ) -> np.ndarray:
        if dither_algorithm == UniformDitherAlgorithm.NONE:
            return batch_nearest_uniform_color(img, num_colors=num_colors)
        elif dither_algorithm == UniformDitherAlgorithm.ORDERED:
            return ordered_dither(
                img, num_colors=num_colors, threshold_map=threshold_map
            )
        elif dither_algorithm == UniformDitherAlgorithm.DIFFUSION:
            return uniform_error_diffusion_dither(
                img, num_colors=num_colors, error_diffusion_map=error_diffusion_map
            )
        elif dither_algorithm == UniformDitherAlgorithm.RIEMERSMA:
            return uniform_riemersma_dither(
                img,
                num_colors=num_colors,
                history_length=history_length,
                decay_ratio=1 / history_length,
            )
