from __future__ import annotations
from typing import Union

import numpy as np

from . import category as ImageChannelCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.utils import get_h_w_c


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
                    channels=4,
                )
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

        def get_channel(img: np.ndarray) -> np.ndarray:
            if img.ndim == 2:
                return img

            c = get_h_w_c(img)[2]
            assert c == 1, (
                "All channel images must only have exactly one channel."
                " Suggestion: Convert to grayscale first."
            )

            return img[:, :, 0]

        channels = [
            get_channel(img_b),
            get_channel(img_g),
            get_channel(img_r),
            get_channel(img_a) if img_a is not None else np.ones(start_shape),
        ]

        return np.stack(channels, axis=2)
