from __future__ import annotations

import math
from functools import reduce
from typing import Dict, Literal

import cv2
import numpy as np

from nodes.impl.image_utils import as_3d
from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import blur_group

# Lens blur adapted from GIMP Lens Blur
# Copyright (c) 2019 Davide Sandona'
# https://github.com/Davide-sd/GIMP-lens-blur.git

kernel_scales = [1.4, 1.2, 1.2, 1.2, 1.2, 1.2]

kernel_params = [
    [
        [0.862325, 1.624835, 0.767583, 1.862321],
    ],
    [
        [0.886528, 5.268909, 0.411259, -0.548794],
        [1.960518, 1.558213, 0.513282, 4.56111],
    ],
    [
        [2.17649, 5.043495, 1.621035, -2.105439],
        [1.019306, 9.027613, -0.28086, -0.162882],
        [2.81511, 1.597273, -0.366471, 10.300301],
    ],
    [
        [4.338459, 1.553635, -5.767909, 46.164397],
        [3.839993, 4.693183, 9.795391, -15.227561],
        [2.791880, 8.178137, -3.048324, 0.302959],
        [1.342190, 12.328289, 0.010001, 0.244650],
    ],
    [
        [4.892608, 1.685979, -22.356787, 85.91246],
        [4.71187, 4.998496, 35.918936, -28.875618],
        [4.052795, 8.244168, -13.212253, -1.578428],
        [2.929212, 11.900859, 0.507991, 1.816328],
        [1.512961, 16.116382, 0.138051, -0.01],
    ],
    [
        [5.143778, 2.079813, -82.326596, 111.231024],
        [5.612426, 6.153387, 113.878661, 58.004879],
        [5.982921, 9.802895, 39.479083, -162.028887],
        [6.505167, 11.059237, -71.286026, 95.027069],
        [3.869579, 14.81052, 1.405746, -3.704914],
        [2.201904, 19.032909, -0.152784, -0.107988],
    ],
]

ParamKey = Literal["a", "b", "A", "B"]
Params = Dict[ParamKey, float]


def get_parameters(component_count: int) -> tuple[list[Params], float]:
    parameter_index = max(0, min(component_count - 1, len(kernel_params) - 1))
    param_keys: list[ParamKey] = ["a", "b", "A", "B"]
    parameter_dictionaries = [
        dict(zip(param_keys, b)) for b in kernel_params[parameter_index]
    ]
    return (parameter_dictionaries, kernel_scales[parameter_index])


def complex_kernel_1d(radius: int, scale: float, a: float, b: float):
    kernel_radius = radius
    kernel_size = kernel_radius * 2 + 1
    ax = np.arange(-kernel_radius, kernel_radius + 1.0, dtype=np.float32)
    ax = ax * scale * (1 / kernel_radius)
    kernel_complex = np.zeros((kernel_size), dtype=np.complex64)
    kernel_complex.real = np.exp(-a * (ax**2)) * np.cos(b * (ax**2))  # type: ignore
    kernel_complex.imag = np.exp(-a * (ax**2)) * np.sin(b * (ax**2))  # type: ignore
    return kernel_complex.reshape((1, kernel_size))


def normalize_kernels(kernels: list[np.ndarray], params: list[Params]):
    total = 0
    for k, p in zip(kernels, params):
        for i in range(k.shape[1]):
            for j in range(k.shape[1]):
                total += p["A"] * (
                    k[0, i].real * k[0, j].real - k[0, i].imag * k[0, j].imag
                ) + p["B"] * (k[0, i].real * k[0, j].imag + k[0, i].imag * k[0, j].real)
    scalar = 1 / math.sqrt(total)
    return [k * scalar for k in kernels]


def weighted_sum(kernel: np.ndarray, params: Params) -> np.ndarray:
    return np.add(kernel.real * params["A"], kernel.imag * params["B"])


def lens_blur(
    img: np.ndarray, radius: int, component_count: int, exposure_gamma: float
) -> np.ndarray:
    img = np.ascontiguousarray(np.transpose(as_3d(img), (2, 0, 1)), dtype=np.float32)
    parameters, scale = get_parameters(component_count)
    components = [
        complex_kernel_1d(radius, scale, component_params["a"], component_params["b"])
        for component_params in parameters
    ]
    components = normalize_kernels(components, parameters)
    img = np.power(img, exposure_gamma)
    component_output = []
    for component, component_params in zip(components, parameters):
        channels = []
        component_real = np.real(component)
        component_imag = np.imag(component)
        component_real_t = component_real.transpose()
        component_imag_t = component_imag.transpose()
        for channel in range(img.shape[0]):
            inter_real = cv2.filter2D(img[channel], -1, component_real)
            inter_imag = cv2.filter2D(img[channel], -1, component_imag)
            final_1 = cv2.filter2D(inter_real, -1, component_real_t)
            final_2 = cv2.filter2D(inter_real, -1, component_imag_t)
            final_3 = cv2.filter2D(inter_imag, -1, component_real_t)
            final_4 = cv2.filter2D(inter_imag, -1, component_imag_t)
            final = final_1 - final_4 + 1j * (final_2 + final_3)  # type: ignore
            channels.append(final)
        component_image = np.stack(
            [weighted_sum(channel, component_params) for channel in channels]
        )
        component_output.append(component_image)
    output_image = reduce(np.add, component_output)
    output_image = np.clip(output_image, 0, None)
    output_image = np.power(output_image, 1.0 / exposure_gamma)
    output_image = np.clip(output_image, 0, 1)
    output_image = output_image.transpose(1, 2, 0)
    return output_image


@blur_group.register(
    schema_id="chainner:image:lens_blur",
    name="镜头模糊",
    description="将镜头模糊应用于图像。",
    icon="MdBlurOn",
    inputs=[
        ImageInput(),
        SliderInput(
            "Radius",
            minimum=0,
            maximum=1000,
            default=3,
            precision=0,
            controls_step=1,
            scale="log",
        ),
        SliderInput(
            "Components",
            minimum=1,
            maximum=6,
            default=5,
            precision=0,
            controls_step=1,
        ).with_docs(
            "This controls the quality of the lens blur. More components will result in a more realistic blur, but will also be slower to compute."
        ),
        SliderInput(
            "Exposure Gamma",
            minimum=0.01,
            maximum=100,
            default=5,
            precision=4,
            controls_step=0.1,
            scale="log",
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def lens_blur_node(
    img: np.ndarray,
    radius: int,
    component_count: int,
    exposure_gamma: float,
) -> np.ndarray:
    if radius == 0:
        return img

    return lens_blur(img, radius, component_count, exposure_gamma)
