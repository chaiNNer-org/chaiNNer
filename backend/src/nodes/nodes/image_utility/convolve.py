from __future__ import annotations

import numpy as np

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput, TextInput
from ...properties.outputs import ImageOutput
from ...properties import expression


@NodeFactory.register("chainner:image:image_convolve")
class ImageConvolveNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Convolves input image with input kernel (kernel values separated by commas)"
        self.inputs = [
            ImageInput(),
            TextInput("Kernel String"),
            NumberInput("Kernel Width/Height", minimum=0, default=3),
            NumberInput("Padding", minimum=0, default=0),
            NumberInput("Strides", minimum=0, default=1),
        ]
        self.outputs = [
            ImageOutput(image_type=expression.Image(size_as="Input0"), channels=1)
        ]
        self.category = ImageUtilityCategory
        self.name = "Convolve"
        self.icon = "MdAutoFixHigh"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        kernel_in: str,
        kernel_dim: int,
        padding: int,
        strides: int,
    ) -> np.ndarray:

        kernel = np.array([float(d) for d in kernel_in.split(",")])
        kernel = kernel.reshape(kernel_dim, kernel_dim)

        # Grayscale image if it is not already
        if len(img.shape) != 2:
            img = img[:, :, 0]

        # Thanks Samrat Sahoo on Medium for the convolution code
        # Cross Correlation
        kernel = np.flipud(np.fliplr(kernel))

        # Gather Shapes of Kernel + Image + Padding
        xKernShape = kernel.shape[0]
        yKernShape = kernel.shape[1]
        xImgShape = img.shape[0]
        yImgShape = img.shape[1]

        # Shape of Output Convolution
        xOutput = int(((xImgShape - xKernShape + 2 * padding) / strides) + 1)
        yOutput = int(((yImgShape - yKernShape + 2 * padding) / strides) + 1)
        output = np.zeros((xOutput, yOutput))

        # Apply Equal Padding to All Sides
        if padding != 0:
            imagePadded = np.zeros(
                (img.shape[0] + padding * 2, img.shape[1] + padding * 2)
            )
            imagePadded[
                int(padding) : int(-1 * padding), int(padding) : int(-1 * padding)
            ] = img
        else:
            imagePadded = img

        # Iterate through image
        for y in range(img.shape[1]):
            # Exit Convolution
            if y > img.shape[1] - yKernShape:
                break
            # Only Convolve if y has gone down by the specified Strides
            if y % strides == 0:
                for x in range(img.shape[0]):
                    # Go to next row once kernel is out of bounds
                    if x > img.shape[0] - xKernShape:
                        break
                    try:
                        # Only Convolve if x has moved by the specified Strides
                        if x % strides == 0:
                            output[x, y] = (
                                kernel
                                * imagePadded[x : x + xKernShape, y : y + yKernShape]
                            ).sum()
                    except:
                        break

        return output
