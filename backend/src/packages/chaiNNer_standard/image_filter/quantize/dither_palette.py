from __future__ import annotations

from enum import Enum
from typing import Dict

import numpy as np
from chainner_ext import (
    DiffusionAlgorithm,
    PaletteQuantization,
    error_diffusion_dither,
    quantize,
    riemersma_dither,
)

import navi
from nodes.groups import if_enum_group
from nodes.impl.dithering.constants import (
    ERROR_PROPAGATION_MAP_LABELS,
    ErrorDiffusionMap,
)
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import quantize_group


class PaletteDitherAlgorithm(Enum):
    NONE = "None"
    DIFFUSION = "Diffusion"
    RIEMERSMA = "Riemersma"


PALETTE_DITHER_ALGORITHM_LABELS = {
    PaletteDitherAlgorithm.NONE: "No dithering",
    PaletteDitherAlgorithm.DIFFUSION: "Error Diffusion",
    PaletteDitherAlgorithm.RIEMERSMA: "Riemersma Dithering",
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


@quantize_group.register(
    schema_id="chainner:image:palette_dither",
    name="Dither (Palette)",
    description="Apply one of a variety of dithering algorithms using colors from a given color palette. (Only the top row of pixels (y=0) of the palette will be used.)",
    see_also="chainner:image:palette_from_image",
    icon="MdShowChart",
    inputs=[
        ImageInput(channels=[1, 3, 4]),
        ImageInput(label="Palette", image_type=navi.Image(channels_as="Input0")),
        EnumInput(
            PaletteDitherAlgorithm,
            option_labels=PALETTE_DITHER_ALGORITHM_LABELS,
            default_value=PaletteDitherAlgorithm.DIFFUSION,
        ).with_id(2),
        if_enum_group(2, PaletteDitherAlgorithm.DIFFUSION)(
            EnumInput(
                ErrorDiffusionMap,
                option_labels=ERROR_PROPAGATION_MAP_LABELS,
                default_value=ErrorDiffusionMap.FLOYD_STEINBERG,
            ).with_id(3),
        ),
        if_enum_group(2, PaletteDitherAlgorithm.RIEMERSMA)(
            NumberInput(
                "History Length",
                minimum=2,
                default=16,
            ).with_id(4),
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def dither_palette_node(
    img: np.ndarray,
    palette: np.ndarray,
    dither_algorithm: PaletteDitherAlgorithm,
    error_diffusion_map: ErrorDiffusionMap,
    history_length: int,
) -> np.ndarray:
    assert (
        get_h_w_c(img)[2] == get_h_w_c(palette)[2]
    ), "Image and palette must have the same number of channels."

    palette = palette[:1, ...]
    quant = PaletteQuantization(palette)

    if dither_algorithm == PaletteDitherAlgorithm.NONE:
        return quantize(img, quant)
    elif dither_algorithm == PaletteDitherAlgorithm.DIFFUSION:
        return error_diffusion_dither(
            img,
            quant,
            _ALGORITHM_MAP[error_diffusion_map],
        )
    elif dither_algorithm == PaletteDitherAlgorithm.RIEMERSMA:
        return riemersma_dither(
            img,
            quant,
            history_length,
            1 / history_length,
        )
