from __future__ import annotations

from enum import Enum

import cv2
import numpy as np

from nodes.groups import if_enum_group
from nodes.impl.image_utils import fast_gaussian_blur
from nodes.properties.inputs import EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import miscellaneous_group


class Algorithm(Enum):
    SOBEL = 1
    SCHARR = 2
    GRADIENT = 3
    DIFFERENTIAL = 4
    ROBERTS = 5
    PREWITT_COMPASS = 6
    LAPLACIAN = 7
    LAPLACIAN_DENOISE = 8
    DIFFERENCE_OF_GAUSSIAN = 9


class GradientComponent(Enum):
    MAGNITUDE = 1
    X = 2
    Y = 3


FILTER_X: dict[Algorithm, np.ndarray] = {
    Algorithm.SOBEL: (
        0.25
        * np.array(
            [
                [-1, 0, +1],
                [-2, 0, +2],
                [-1, 0, +1],
            ]
        ).astype(np.float32)
    ),
    Algorithm.SCHARR: (
        (1 / 256)
        * np.array(
            [
                [-47, 0, +47],
                [-162, 0, +162],
                [-47, 0, +47],
            ]
        ).astype(np.float32)
    ),
    Algorithm.GRADIENT: (
        np.array(
            [
                [0, 0, 0],
                [-1, 1, 0],
                [0, 0, 0],
            ]
        ).astype(np.float32)
    ),
    Algorithm.DIFFERENTIAL: (
        0.5
        * np.array(
            [
                [0, 0, 0],
                [0, -1, +1],
                [0, -1, +1],
            ]
        ).astype(np.float32)
    ),
    Algorithm.ROBERTS: (
        np.array(
            [
                [0, 0, 0],
                [0, +1, 0],
                [0, 0, -1],
            ]
        ).astype(np.float32)
    ),
}

FILTER_Y: dict[Algorithm, np.ndarray] = {
    Algorithm.DIFFERENTIAL: (
        0.5
        * np.array(
            [
                [0, 0, 0],
                [0, +1, +1],
                [0, -1, -1],
            ]
        ).astype(np.float32)
    ),
    Algorithm.ROBERTS: (
        np.array(
            [
                [0, 0, 0],
                [0, 0, +1],
                [0, -1, 0],
            ]
        ).astype(np.float32)
    ),
}

LAPLACE_KERNEL = 0.25 * np.array(
    [
        [1, 1, 1],
        [1, -8, 1],
        [1, 1, 1],
    ]
).astype(np.float32)


@miscellaneous_group.register(
    schema_id="chainner:image:edge_detection",
    name="Edge Detection",
    description=(
        "Detect the edges of the input image with a variety of algorithms. The output will be the magnitude of the gradient per channel. The alpha channel will be copied from the input image."
    ),
    icon="MdAutoFixHigh",
    inputs=[
        ImageInput(),
        SliderInput(
            "Amount", minimum=0, default=1, maximum=10, precision=2, scale="log"
        ),
        EnumInput(Algorithm).with_id(2),
        if_enum_group(
            2,
            (
                Algorithm.SOBEL,
                Algorithm.SCHARR,
                Algorithm.GRADIENT,
                Algorithm.DIFFERENTIAL,
            ),
        )(
            EnumInput(GradientComponent),
        ),
        if_enum_group(2, Algorithm.DIFFERENCE_OF_GAUSSIAN)(
            SliderInput("Radius 1", minimum=0, default=1, maximum=10, precision=3),
            SliderInput("Radius 2", minimum=0, default=2, maximum=20, precision=3),
        ),
    ],
    outputs=[ImageOutput(shape_as=0)],
)
def edge_detection_node(
    img: np.ndarray,
    amount: float,
    algorithm: Algorithm,
    gradient_component: GradientComponent,
    radius_1: float,
    radius_2: float,
) -> np.ndarray:
    c = get_h_w_c(img)[2]
    alpha = None
    if c >= 4:
        alpha = img[:, :, 3:]
        img = img[:, :, :3]

    if algorithm in (
        Algorithm.SOBEL,
        Algorithm.SCHARR,
        Algorithm.GRADIENT,
        Algorithm.DIFFERENTIAL,
        Algorithm.ROBERTS,
    ):
        filter_x = FILTER_X[algorithm]
        filter_y = FILTER_Y.get(algorithm)

        def g_x() -> np.ndarray:
            return cv2.filter2D(img, -1, filter_x)

        def g_y() -> np.ndarray:
            filter = filter_y if filter_y is not None else np.rot90(filter_x, 1)
            return cv2.filter2D(img, -1, filter)

        if algorithm == Algorithm.ROBERTS:
            gradient_component = GradientComponent.MAGNITUDE

        if gradient_component == GradientComponent.MAGNITUDE:
            img = np.hypot(g_x(), g_y()) * (amount / 2)
        elif gradient_component == GradientComponent.X:
            img = g_x() * (amount / 2) + 0.5
        elif gradient_component == GradientComponent.Y:
            img = g_y() * (amount / 2) + 0.5
        else:
            raise ValueError(f"Invalid gradient component: {gradient_component}")

    elif algorithm == Algorithm.PREWITT_COMPASS:
        img = prewitt_compass(img) * (amount / 2)

    elif algorithm == Algorithm.LAPLACIAN:
        img = cv2.filter2D(img, -1, LAPLACE_KERNEL) * amount  # type: ignore

    elif algorithm == Algorithm.LAPLACIAN_DENOISE:
        img = laplacian_denoise(img) * amount

    elif algorithm == Algorithm.DIFFERENCE_OF_GAUSSIAN:
        g1 = fast_gaussian_blur(img, radius_1)
        g2 = fast_gaussian_blur(img, radius_2)
        img = (g1 - g2) * amount

    img = np.clip(img, 0, 1)  # type: ignore

    if alpha is not None:
        img = np.dstack((img, alpha))
    return img


def prewitt_compass(img: np.ndarray) -> np.ndarray:
    filter_0 = 0.25 * np.array(
        [
            [-1, +1, +1],
            [-1, -2, +1],
            [-1, +1, +1],
        ]
    ).astype(np.float32)
    filter_45 = 0.25 * np.array(
        [
            [+1, +1, +1],
            [-1, -2, +1],
            [-1, -1, +1],
        ]
    ).astype(np.float32)

    g = np.abs(cv2.filter2D(img, -1, filter_0))
    for i in range(1, 4):
        g = np.maximum(g, np.abs(cv2.filter2D(img, -1, np.rot90(filter_0, i))))
    for i in range(4):
        g = np.maximum(g, np.abs(cv2.filter2D(img, -1, np.rot90(filter_45, i))))

    return g


def laplacian_denoise(img: np.ndarray) -> np.ndarray:
    # Modified version of Gimp's Laplace filter.
    # https://gitlab.gnome.org/GNOME/gegl/-/blob/master/opencl/edge-laplace.cl
    # Changes: Instead of using the laplacian to get the sign of the magnitude,
    # we use it as a clipped factor. This eliminates abrupt changes in the
    # output image and has an even stronger denoising effect.
    max_val = cv2.dilate(img, cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3)))
    min_val = cv2.erode(img, cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3)))
    laplace = cv2.filter2D(img, -1, LAPLACE_KERNEL)
    return np.maximum(max_val - img, img - min_val) * np.clip(laplace * 10, -0.75, 0.75)  # type: ignore
