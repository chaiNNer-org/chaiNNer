from __future__ import annotations

import math
import numpy as np
from scipy import signal
from functools import reduce

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput, SliderInput
from ...properties.outputs import ImageOutput

# lens blur adapted from: https://github.com/NatLee/Blur-Generator

kernel_scales = [1.4,1.2,1.2,1.2,1.2,1.2]

kernel_params = [
                [[0.862325, 1.624835, 0.767583, 1.862321]],

                [[0.886528, 5.268909, 0.411259, -0.548794],
                [1.960518, 1.558213, 0.513282, 4.56111]],

                [[2.17649, 5.043495, 1.621035, -2.105439],
                [1.019306, 9.027613, -0.28086, -0.162882],
                [2.81511, 1.597273, -0.366471, 10.300301]],

                [[4.338459, 1.553635, -5.767909, 46.164397],
                [3.839993, 4.693183, 9.795391, -15.227561],
                [2.791880, 8.178137, -3.048324, 0.302959],
                [1.342190, 12.328289, 0.010001, 0.244650]],

                [[4.892608, 1.685979, -22.356787, 85.91246],
                [4.71187, 4.998496, 35.918936, -28.875618],
                [4.052795, 8.244168, -13.212253, -1.578428],
                [2.929212, 11.900859, 0.507991, 1.816328],
                [1.512961, 16.116382, 0.138051, -0.01]],

                [[5.143778, 2.079813, -82.326596, 111.231024],
                [5.612426, 6.153387, 113.878661, 58.004879],
                [5.982921, 9.802895, 39.479083, -162.028887],
                [6.505167, 11.059237, -71.286026, 95.027069],
                [3.869579, 14.81052, 1.405746, -3.704914],
                [2.201904, 19.032909, -0.152784, -0.107988]]]

def get_parameters(component_count = 2):
    parameter_index = max(0, min(component_count - 1, len(kernel_params)))
    parameter_dictionaries = [dict(zip(['a','b','A','B'], b)) for b in kernel_params[parameter_index]]
    return (parameter_dictionaries, kernel_scales[parameter_index])

def complex_kernel_1d(radius, scale, a, b):
    kernel_radius = radius
    kernel_size = kernel_radius * 2 + 1
    ax = np.arange(-kernel_radius, kernel_radius + 1., dtype=np.float32)
    ax = ax * scale * (1 / kernel_radius)
    kernel_complex = np.zeros((kernel_size), dtype=np.complex64)
    kernel_complex.real = np.exp(-a * (ax**2)) * np.cos(b * (ax**2))
    kernel_complex.imag = np.exp(-a * (ax**2)) * np.sin(b * (ax**2))
    return kernel_complex.reshape((1, kernel_size))

def normalise_kernels(kernels, params):
    total = 0
    for k,p in zip(kernels, params):
        for i in range(k.shape[1]):
            for j in range(k.shape[1]):
                total += p['A'] * (k[0,i].real*k[0,j].real - k[0,i].imag*k[0,j].imag) + p['B'] * (k[0,i].real*k[0,j].imag + k[0,i].imag*k[0,j].real)
    scalar = 1 / math.sqrt(total)
    kernels = np.asarray(kernels) * scalar
    return kernels

def weighted_sum(kernel, params):
    return np.add(kernel.real * params['A'], kernel.imag * params['B'])

def multiply_kernel(kernel):
    kernel_size = kernel.shape[1]
    a = np.repeat(kernel, kernel_size, 0)
    b = np.repeat(kernel.transpose(), kernel_size, 1)
    return np.multiply(a,b)

def lens_blur(img, radius=3, components=5, exposure_gamma=5):
    img = np.ascontiguousarray(img.transpose(2,0,1), dtype=np.float32)
    parameters, scale = get_parameters(component_count = components)
    components = [complex_kernel_1d(radius, scale, component_params['a'], component_params['b']) for component_params in parameters]
    components = normalise_kernels(components, parameters)
    img = np.power(img, exposure_gamma)
    component_output = list()
    for component, component_params in zip(components, parameters):
        channels = list()
        for channel in range(img.shape[0]):
            inter = signal.convolve2d(img[channel], component, boundary='symm', mode='same')
            channels.append(signal.convolve2d(inter, component.transpose(), boundary='symm', mode='same'))
        component_image = np.stack([weighted_sum(channel, component_params) for channel in channels])
        component_output.append(component_image)
    output_image = reduce(np.add, component_output)
    output_image = np.clip(output_image, 0, None)
    output_image = np.power(output_image, 1.0/exposure_gamma)
    output_image = np.clip(output_image, 0, 1)
    output_image = output_image.transpose(1,2,0)
    return output_image

@NodeFactory.register("chainner:image:lens_blur")
class LensBlurNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply Lens blur to an image."
        self.inputs = [
            ImageInput(),
            NumberInput(
                "Radius",
                minimum=1,
                default=3,
                precision=1,
                controls_step=1,
            ),
            SliderInput(
                "Components",
                minimum=1,
                maximum=6,
                default=5,
                precision=0,
                controls_step=1,
            ),
            NumberInput(
                "Exposure Gamma",
                minimum=0.01,
                maximum=100,
                default=5,
                precision=4,
                controls_step=0.1,
            ),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Lens Blur"
        self.icon = "MdBlurOn"
        self.sub = "Blur"

    def run(
        self,
        img: np.ndarray,
        in_radius: int,
        in_components: int,
        in_exposure_gamma: float
    ) -> np.ndarray:
        """Adjusts the blur of an image"""

        if 0 in [in_radius, in_components, in_exposure_gamma]:
            return img
        else:
            return lens_blur(img, radius=in_radius, components=in_components, exposure_gamma=in_exposure_gamma)
