from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.groups import if_enum_group
from nodes.impl.dithering.color_distance import batch_nearest_palette_color
from nodes.impl.dithering.constants import (
    ERROR_PROPAGATION_MAP_LABELS,
    ErrorDiffusionMap,
)
from nodes.impl.dithering.diffusion import palette_error_diffusion_dither
from nodes.impl.dithering.riemersma import palette_riemersma_dither
from nodes.properties import expression
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


@quantize_group.register(
    schema_id="chainner:image:palette_dither",
    name="Dither (Palette)",
    description="Apply one of a variety of dithering algorithms using colors from a given palette. (Only the top row of pixels (y=0) of the palette will be used.)",
    icon="MdShowChart",
    inputs=[
        ImageInput(),
        ImageInput(label="Palette", image_type=expression.Image(channels_as="Input0")),
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
def palette_dither_node(
    img: np.ndarray,
    palette: np.ndarray,
    dither_algorithm: PaletteDitherAlgorithm,
    error_diffusion_map: ErrorDiffusionMap,
    history_length: int,
) -> np.ndarray:
    assert (
        get_h_w_c(img)[2] == get_h_w_c(palette)[2]
    ), "Image and palette must have the same number of channels."

    if dither_algorithm == PaletteDitherAlgorithm.NONE:
        return batch_nearest_palette_color(
            img,
            palette=palette,
        )
    elif dither_algorithm == PaletteDitherAlgorithm.DIFFUSION:
        return palette_error_diffusion_dither(
            img,
            palette=palette,
            error_diffusion_map=error_diffusion_map,
        )
    elif dither_algorithm == PaletteDitherAlgorithm.RIEMERSMA:
        return palette_riemersma_dither(
            img,
            palette,
            history_length=history_length,
            decay_ratio=1 / history_length,
        )
