from __future__ import annotations

from typing import Union

import numpy as np

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import ImageInput
from ...properties.outputs import ImageOutput
from . import category as ImageChannelCategory


@NodeFactory.register("chainner:image:combine_rgba")
class CombineRgbaNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Merges the given channels together and returns an RGBA image."
            " All channel images must be a single channel image."
        )
        self.inputs = [
            ImageInput("R Channel", channels=1),
            ImageInput("G Channel", channels=1),
            ImageInput("B Channel", channels=1),
            ImageInput("A Channel", channels=1).make_optional(),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input0.width & Input1.width & Input2.width & match Input3 { Image as i => i.width, _ => any }",
                    height="Input0.height & Input1.height & Input2.height & match Input3 { Image as i => i.height, _ => any }",
                ),
                channels=4,
            ).with_never_reason(
                "The input channels have different sizes but must all be the same size."
            )
        ]
        self.category = ImageChannelCategory
        self.name = "Combine RGBA"
        self.icon = "MdCallMerge"
        self.sub = "All"

    def run(
        self,
        img_r: np.ndarray,
        img_g: np.ndarray,
        img_b: np.ndarray,
        img_a: Union[np.ndarray, None],
    ) -> np.ndarray:
        start_shape = img_r.shape[:2]

        for im in img_g, img_b, img_a:
            if im is not None:
                assert (
                    im.shape[:2] == start_shape
                ), "All channel images must have the same resolution"

        channels = [
            img_b,
            img_g,
            img_r,
            img_a if img_a is not None else np.ones(start_shape),
        ]

        return np.stack(channels, axis=2)
