from __future__ import annotations

from enum import Enum
from typing import Dict

import numpy as np
from chainner_ext import (
    DiffusionAlgorithm,
    uniform_error_diffusion_dither,
    uniform_ordered_dither,
    uniform_riemersma_dither,
)

from nodes.groups import if_enum_group
from nodes.impl.dithering.color_distance import batch_nearest_uniform_color
from nodes.impl.dithering.constants import (
    ERROR_PROPAGATION_MAP_LABELS,
    THRESHOLD_MAP_LABELS,
    ErrorDiffusionMap,
    ThresholdMap,
)
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import quantize_group

_THRESHOLD_MAP: Dict[ThresholdMap, int] = {
    ThresholdMap.BAYER_2: 2,
    ThresholdMap.BAYER_4: 4,
    ThresholdMap.BAYER_8: 8,
    ThresholdMap.BAYER_16: 16,
}
_ALGORITHM_MAP: Dict[ErrorDiffusionMap, DiffusionAlgorithm] = {
    ErrorDiffusionMap.FLOYD_STEINBERG: DiffusionAlgorithm.FloydSteinberg,
    ErrorDiffusionMap.JARVIS_ET_AL: DiffusionAlgorithm.JarvisJudiceNinke,
    ErrorDiffusionMap.STUCKI: DiffusionAlgorithm.Stucki,
    ErrorDiffusionMap.ATKINSON: DiffusionAlgorithm.Atkinson,
    ErrorDiffusionMap.BURKES: DiffusionAlgorithm.Burkes,
    ErrorDiffusionMap.SIERRA: DiffusionAlgorithm.Sierra,
    ErrorDiffusionMap.TWO_ROW_SIERRA: DiffusionAlgorithm.TwoRowSierra,
    ErrorDiffusionMap.SIERRA_LITE: DiffusionAlgorithm.SierraLite,
}


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


@quantize_group.register(
    schema_id="chainner:image:dither",
    name="Dither",
    description="Apply one of a variety of dithering algorithms with a uniform (evenly-spaced) palette.",
    icon="MdShowChart",
    inputs=[
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
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def dither_node(
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
        return uniform_ordered_dither(
            img,
            num_colors,
            _THRESHOLD_MAP[threshold_map],
        )
    elif dither_algorithm == UniformDitherAlgorithm.DIFFUSION:
        return uniform_error_diffusion_dither(
            img,
            num_colors,
            _ALGORITHM_MAP[error_diffusion_map],
        )
    elif dither_algorithm == UniformDitherAlgorithm.RIEMERSMA:
        return uniform_riemersma_dither(
            img,
            num_colors,
            history_length,
            1 / history_length,
        )
