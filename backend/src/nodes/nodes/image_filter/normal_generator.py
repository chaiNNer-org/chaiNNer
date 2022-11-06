from __future__ import annotations

from typing import Dict

import cv2
import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import (
    ImageInput,
    SliderInput,
    EdgeFilterInput,
    NormalChannelInvertInput,
)
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.image_utils import get_h_w_c


def as_grayscale(img: np.ndarray) -> np.ndarray:
    c = get_h_w_c(img)[2]
    if c == 1:
        return img
    if c == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    assert False, "Only grayscale and RGB images are supported."


def normalize(x: np.ndarray, y: np.ndarray, z: float):
    h, w, _ = get_h_w_c(x)
    l = np.sqrt(np.square(x) + np.square(y) + z * z)
    return x / l, y / l, np.ones((h, w), dtype=np.float32) * z / l


filters_x: Dict[str, np.ndarray] = {
    "sobel": np.array(
        [
            [+1, 0, -1],
            [+2, 0, -2],
            [+1, 0, -1],
        ]
    ),
    "scharr": np.array(
        [
            [+3, 0, -3],
            [+10, 0, -10],
            [+3, 0, -3],
        ]
    ),
}


@NodeFactory.register("chainner:image:normal_generator")
class NormalMapGenerator(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Generate a normal map from a given image."""
        self.inputs = [
            ImageInput("Image", channels=[1, 3]),
            SliderInput("Blur/Sharp", minimum=-20, maximum=20, default=0, precision=1),
            SliderInput("Strength", minimum=-10, maximum=10, default=0, precision=1),
            EdgeFilterInput(),
            NormalChannelInvertInput(),
        ]
        self.outputs = [
            ImageOutput(
                "Normal Map",
                image_type=expression.Image(size_as="Input0"),
                channels=3,
            ),
        ]
        self.category = ImageFilterCategory
        self.name = "Normal Map Generator"
        self.icon = "MdAddCircleOutline"
        self.sub = "Normal Map"

    def run(
        self,
        img: np.ndarray,
        blur_sharp: float,
        strength: float,
        filter_name: str,
        invert: int,
    ) -> np.ndarray:
        img = as_grayscale(img)

        if blur_sharp < 0:
            # blur
            img = cv2.GaussianBlur(img, (0, 0), sigmaX=-blur_sharp, sigmaY=-blur_sharp)
        elif blur_sharp > 0:
            # sharpen
            blurred = cv2.GaussianBlur(
                img, (0, 0), sigmaX=blur_sharp, sigmaY=blur_sharp
            )
            img = cv2.addWeighted(img, 2.0, blurred, -1.0, 0)

        filter_x = filters_x.get(filter_name, None)
        assert filter_x is not None, f"Unknown filter '{filter_name}'"
        filter_y = np.rot90(filter_x, -1)

        dx = cv2.filter2D(img, -1, filter_x)
        dy = cv2.filter2D(img, -1, filter_y)

        z_bias = 1 / (strength + 1) if strength > 0 else 1 - strength
        x, y, z = normalize(dx, dy, z_bias)

        if invert & 1 != 0:
            x = -x
        if invert & 2 != 0:
            y = -y

        bgr = np.abs(z), (y + 1) * 0.5, (x + 1) * 0.5
        return np.clip(cv2.merge(bgr), 0, 1)
