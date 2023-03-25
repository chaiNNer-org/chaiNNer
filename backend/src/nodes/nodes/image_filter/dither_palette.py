from __future__ import annotations

from enum import Enum

import numpy as np

from ...groups import if_enum_group
from ...impl.dithering.color_distance import batch_nearest_palette_color
from ...impl.dithering.constants import ERROR_PROPAGATION_MAP_LABELS, ErrorDiffusionMap
from ...impl.dithering.diffusion import palette_error_diffusion_dither
from ...impl.dithering.riemersma import palette_riemersma_dither
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import EnumInput, ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from . import category as ImageFilterCategory


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
            ImageInput(
                label="Palette", image_type=expression.Image(channels_as="Input0")
            ),
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
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Dither (Palette)"
        self.icon = "MdShowChart"
        self.sub = "Quantize"

    def run(
        self,
        img: np.ndarray,
        palette: np.ndarray,
        dither_algorithm: PaletteDitherAlgorithm,
        error_diffusion_map: ErrorDiffusionMap,
        history_length: int,
    ) -> np.ndarray:
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
