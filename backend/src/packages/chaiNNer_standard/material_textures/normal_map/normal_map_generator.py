from __future__ import annotations

from enum import Enum

import cv2
import numpy as np

import navi
from nodes.groups import if_enum_group
from nodes.impl.image_utils import fast_gaussian_blur
from nodes.impl.normals.edge_filter import EdgeFilter, get_filter_kernels
from nodes.impl.normals.height import HeightSource, get_height_map
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
    raise AssertionError("Only grayscale and RGB images are supported.")


def normalize(x: np.ndarray, y: np.ndarray):
    h, w, _ = get_h_w_c(x)
    # No idea why, but that's the value NvTT uses
    z = 2
    l = np.sqrt(np.square(x) + np.square(y) + z * z)
    return x / l, y / l, np.ones((h, w), dtype=np.float32) * z / l


@normal_map_group.register(
    schema_id="chainner:image:normal_generator",
    name="Normal Map Generator",
    description=[
        "Generate a normal map from a given image using the specified filtering technique.",
        "The node will first convert the given image into a height map. A filter is then applied to the height map to calculate the normal map.",
        "### Height map generation",
        "Since this node needs a height map, it will always convert the input image into one. The **Height Source** input determines how this conversion happens.",
        "Generally, if you have already have a good height map for a texture, use it with *Average RGB* for best results.",
        "If you have a albedo/diffuse texture, most height sources will approximate the height map using pixel brightness. This is a very crude approximation, but can work well enough. Start with *Average RGB* and test our difference filters before using a different height source.",
        "### Filters",
        "There are many filters available. Generally, the *Sobel (dUdV) (3x3)* filter is a good choice for obtaining a normal map. Since the filter is small and not too aggressive, it works well even with crude height maps (e.g. height maps obtained from albedo/diffuse textures). For a more aggressive filter, try *Scharr (3x3)* or *4 Sample (1x3)*.",
        "If you want more control over the output normal map, use the *Multi Gaussian* filter. This filter operates on multiple frequencies and allows you to control the strength of each frequency. This allows you to adjust the influence of tiny details and large features. *Scale 1** is the strength of the smallest details, and **Scale 8** is the strength of the largest features.",
        "Note: If you set **Scale 1** to 1 and all other scales to 0, you will get (almost) the same result as the *4 Sample (1x3)* filter. If you set **Scale 2** to 1 and all other scales to 0, you will get (almost) the same result as the *Sobel (dUdV) (3x3)* filter.",
    ],
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput("Image", channels=[1, 3, 4]),
        EnumInput(
            HeightSource,
            label="Height Source",
            default=HeightSource.AVERAGE_RGB,
        ).with_docs(
            "Given the R, G, B, A channels of the input image, a height map will be calculated as follows:",
            "- Average RGB: `Height = (R + G + B) / 3`",
            "- Max RGB: `Height = max(R, G, B)`",
            "- Screen RGB: `Height = 1 - ((1 - R) * (1 - G) * (1 - B))`",
            "- Red: `Height = R`",
            "- Green: `Height = G`",
            "- Blue: `Height = B`",
            "- Alpha: `Height = A`",
        ),
        SliderInput(
            "Blur/Sharp",
            minimum=-20,
            maximum=20,
            default=0,
            precision=1,
        ).with_docs(
            "A quick way to blur or sharpen the height map. Negative values blur, positive values sharpen."
        ),
        SliderInput(
            "Min Z",
            minimum=0,
            maximum=1,
            default=0,
            precision=3,
            slider_step=0.01,
            controls_step=0.05,
        ).with_docs(
            "A minimum height that can be used to cut off low height values.",
            "This value is generally only useful in specific circumstances, so it's usually best to leave it at 0.",
        ),
        SliderInput(
            "Scale",
            minimum=0,
            maximum=100,
            default=1,
            precision=3,
            controls_step=0.1,
            scale="log-offset",
        ).with_docs(
            "A factor applied to the height map.",
            "The smaller the scale, the most flat the output normal map will be. The large the scale, the more pronounced the normal map will be.",
        ),
        EnumInput(
            EdgeFilter,
            label="Filter",
            default=EdgeFilter.SOBEL,
            option_labels={
                EdgeFilter.SOBEL: "Sobel (dUdV) (3x3)",
                EdgeFilter.SOBEL_LIKE_5: "Sobel-like (5x5)",
                EdgeFilter.SOBEL_LIKE_7: "Sobel-like (7x7)",
                EdgeFilter.SOBEL_LIKE_9: "Sobel-like (9x9)",
                EdgeFilter.PREWITT: "Prewitt (3x3)",
                EdgeFilter.SCHARR: "Scharr (3x3)",
                EdgeFilter.FOUR_SAMPLE: "4 Sample (1x3)",
                EdgeFilter.MULTI_GAUSS: "Multi Gaussian",
            },
        ).with_id(5),
        if_enum_group(5, EdgeFilter.MULTI_GAUSS)(
            SliderInput(
                "Scale 1",
                minimum=0,
                maximum=10,
                default=0.25,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(8),
            SliderInput(
                "Scale 2",
                minimum=0,
                maximum=10,
                default=0.5,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(9),
            SliderInput(
                "Scale 3",
                minimum=0,
                maximum=10,
                default=0.3,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(10),
            SliderInput(
                "Scale 4",
                minimum=0,
                maximum=10,
                default=0.25,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(11),
            SliderInput(
                "Scale 5",
                minimum=0,
                maximum=10,
                default=0.2,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(12),
            SliderInput(
                "Scale 6",
                minimum=0,
                maximum=10,
                default=0.15,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(13),
            SliderInput(
                "Scale 7",
                minimum=0,
                maximum=10,
                default=0.10,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(14),
            SliderInput(
                "Scale 8",
                minimum=0,
                maximum=10,
                default=0.10,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(15),
        ),
        NormalChannelInvertInput()
        .with_id(6)
        .with_docs("Whether to invert some channels of the normal map."),
        EnumInput(
            AlphaOutput,
            label="Alpha Channel",
            default=AlphaOutput.NONE,
            option_labels={AlphaOutput.ONE: "Set to 1"},
        ).with_id(7),
    ],
    outputs=[
        ImageOutput(
            "Normal Map",
            image_type=navi.Image(
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
    gauss_scale1: float,
    gauss_scale2: float,
    gauss_scale3: float,
    gauss_scale4: float,
    gauss_scale5: float,
    gauss_scale6: float,
    gauss_scale7: float,
    gauss_scale8: float,
    invert: int,
    alpha_output: AlphaOutput,
) -> np.ndarray:
    h, w, c = get_h_w_c(img)
    height = get_height_map(img, height_source)

    if blur_sharp < 0:
        # blur
        height = fast_gaussian_blur(height, -blur_sharp)
    elif blur_sharp > 0:
        # sharpen
        blurred = fast_gaussian_blur(height, blur_sharp)
        height = cv2.addWeighted(height, 2.0, blurred, -1.0, 0)

    if min_z > 0:
        height = np.maximum(min_z, height)
    if scale != 0:
        height = height * scale  # type: ignore

    filter_x, filter_y = get_filter_kernels(
        edge_filter,
        gauss_parameter=[
            (1 / 4, gauss_scale1),
            (2 / 4, gauss_scale2),
            (4 / 4, gauss_scale3),
            (8 / 4, gauss_scale4),
            (16 / 4, gauss_scale5),
            (32 / 4, gauss_scale6),
            (64 / 4, gauss_scale7),
            (128 / 4, gauss_scale8),
        ],
    )

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
        raise AssertionError(f"Invalid alpha output '{alpha_output}'")

    r = (x + 1) * 0.5
    g = (y + 1) * 0.5
    b = np.abs(z)

    channels = (b, g, r) if a is None else (b, g, r, a)

    return cv2.merge(channels)
