from __future__ import annotations

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
    HeightMapSourceInput,
    NormalMappingAlphaInput,
)
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.edge_filter import EdgeFilter, get_filter_kernels
from ...utils.height import get_height_map
from ...utils.image_utils import get_h_w_c


def as_grayscale(img: np.ndarray) -> np.ndarray:
    c = get_h_w_c(img)[2]
    if c == 1:
        return img
    if c == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    assert False, "Only grayscale and RGB images are supported."


def normalize(x: np.ndarray, y: np.ndarray):
    h, w, _ = get_h_w_c(x)
    # No idea why, but that's the value NvTT uses
    z = 2
    l = np.sqrt(np.square(x) + np.square(y) + z * z)
    return x / l, y / l, np.ones((h, w), dtype=np.float32) * z / l


@NodeFactory.register("chainner:image:normal_generator")
class NormalMapGenerator(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Generate a normal map from a given image."""
        self.inputs = [
            ImageInput("Image", channels=[1, 3, 4]),
            HeightMapSourceInput(),
            SliderInput(
                "Blur/Sharp",
                minimum=-20,
                maximum=20,
                default=0,
                precision=1,
            ),
            SliderInput(
                "Min Z",
                minimum=0,
                maximum=1,
                default=0,
                precision=3,
                slider_step=0.01,
                controls_step=0.05,
            ),
            SliderInput(
                "Scale",
                minimum=0,
                maximum=100,
                default=1,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
            ),
            EdgeFilterInput(),
            NormalChannelInvertInput(),
            NormalMappingAlphaInput(),
        ]
        self.outputs = [
            ImageOutput(
                "Normal Map",
                image_type=expression.Image(
                    size_as="Input0",
                    channels="match Input7 { NormalMappingAlpha::None => 3, _ => 4 }",
                ),
            ),
        ]
        self.category = ImageFilterCategory
        self.name = "Normal Map Generator"
        self.icon = "MdOutlineAutoFixHigh"
        self.sub = "Normal Map"

    def run(
        self,
        img: np.ndarray,
        height_source: int,
        blur_sharp: float,
        min_z: float,
        scale: float,
        edge_filter: EdgeFilter,
        invert: int,
        alpha_output: str,
    ) -> np.ndarray:
        h, w, c = get_h_w_c(img)
        height = get_height_map(img, height_source)

        if blur_sharp < 0:
            # blur
            height = cv2.GaussianBlur(
                height, (0, 0), sigmaX=-blur_sharp, sigmaY=-blur_sharp
            )
        elif blur_sharp > 0:
            # sharpen
            blurred = cv2.GaussianBlur(
                height, (0, 0), sigmaX=blur_sharp, sigmaY=blur_sharp
            )
            height = cv2.addWeighted(height, 2.0, blurred, -1.0, 0)

        if min_z > 0:
            height = np.maximum(min_z, height)
        if scale != 0:
            height = height * scale

        filter_x, filter_y = get_filter_kernels(edge_filter)

        dx = cv2.filter2D(height, -1, filter_x)
        dy = cv2.filter2D(height, -1, filter_y)

        x, y, z = normalize(dx, dy)

        if invert & 1 != 0:
            x = -x
        if invert & 2 != 0:
            y = -y

        if alpha_output == "none":
            a = None
        elif alpha_output == "height":
            a = height
        elif alpha_output == "unchanged":
            a = np.ones((h, w), dtype=np.float32) if c < 4 else img[:, :, 3]
        elif alpha_output == "one":
            a = np.ones((h, w), dtype=np.float32)
        else:
            assert False, f"Invalid alpha output '{alpha_output}'"

        r = (x + 1) * 0.5
        g = (y + 1) * 0.5
        b = np.abs(z)

        channels = (b, g, r) if a is None else (b, g, r, a)

        return np.clip(cv2.merge(channels), 0, 1)
