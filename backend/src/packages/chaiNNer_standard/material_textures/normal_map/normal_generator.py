from __future__ import annotations

from enum import Enum

import cv2
import numpy as np

from nodes.impl.normals.edge_filter import EdgeFilter, get_filter_kernels
from nodes.impl.normals.height import HeightSource, get_height_map
from nodes.properties import expression
from nodes.properties.inputs import (
    EnumInput,
    ImageInput,
    NormalChannelInvertInput,
    SliderInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import normal_map_group


class AlphaOutput(Enum):
    NONE = "none"
    UNCHANGED = "unchanged"
    HEIGHT = "height"
    ONE = "one"


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


@normal_map_group.register(
    schema_id="chainner:image:normal_generator",
    name="Normal Map Generator",
    description="""Generate a normal map from a given image.""",
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput("Image", channels=[1, 3, 4]),
        EnumInput(
            HeightSource,
            label="Height Source",
            default_value=HeightSource.AVERAGE_RGB,
        ),
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
        EnumInput(
            EdgeFilter,
            label="Filter",
            default_value=EdgeFilter.SOBEL,
            option_labels={
                EdgeFilter.SOBEL: "Sobel (dUdV) (3x3)",
                EdgeFilter.SOBEL_LIKE_5: "Sobel-like (5x5)",
                EdgeFilter.SOBEL_LIKE_7: "Sobel-like (7x7)",
                EdgeFilter.SOBEL_LIKE_9: "Sobel-like (9x9)",
                EdgeFilter.PREWITT: "Prewitt (3x3)",
                EdgeFilter.SCHARR: "Scharr (3x3)",
                EdgeFilter.FOUR_SAMPLE: "4 Sample (1x3)",
            },
        ),
        NormalChannelInvertInput(),
        EnumInput(
            AlphaOutput,
            label="Alpha Channel",
            default_value=AlphaOutput.NONE,
            option_labels={AlphaOutput.ONE: "Set to 1"},
        ),
    ],
    outputs=[
        ImageOutput(
            "Normal Map",
            image_type=expression.Image(
                size_as="Input0",
                channels="match Input7 { AlphaOutput::None => 3, _ => 4 }",
            ),
        ),
    ],
)
def normal_map_generator_node(
    img: np.ndarray,
    height_source: HeightSource,
    blur_sharp: float,
    min_z: float,
    scale: float,
    edge_filter: EdgeFilter,
    invert: int,
    alpha_output: AlphaOutput,
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
        blurred = cv2.GaussianBlur(height, (0, 0), sigmaX=blur_sharp, sigmaY=blur_sharp)
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

    if alpha_output is AlphaOutput.NONE:
        a = None
    elif alpha_output is AlphaOutput.HEIGHT:
        a = height
    elif alpha_output is AlphaOutput.UNCHANGED:
        a = np.ones((h, w), dtype=np.float32) if c < 4 else img[:, :, 3]
    elif alpha_output is AlphaOutput.ONE:
        a = np.ones((h, w), dtype=np.float32)
    else:
        assert False, f"Invalid alpha output '{alpha_output}'"

    r = (x + 1) * 0.5
    g = (y + 1) * 0.5
    b = np.abs(z)

    channels = (b, g, r) if a is None else (b, g, r, a)

    return cv2.merge(channels)
