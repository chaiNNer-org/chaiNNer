from __future__ import annotations

import cv2
import numpy as np

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NoteTextAreaInput, NumberInput
from ...properties.outputs import ImageOutput
from . import category as ImageFilterCategory


@NodeFactory.register("chainner:image:image_convolve")
class ImageConvolveNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Convolves input image with input kernel"
        self.inputs = [
            ImageInput("Image"),
            NoteTextAreaInput("Kernel String"),
            NumberInput("Padding", minimum=0, default=0),
        ]
        self.outputs = [
            ImageOutput(
                image_type="""
                    let w = Input0.width;
                    let h = Input0.height;

                    let kernel = Input1;

                    let padding = Input2;

                    Image {
                        width: w + padding * 2,
                        height: h + padding * 2,
                    }
                """,
            )
        ]
        self.category = ImageFilterCategory
        self.name = "Convolve"
        self.icon = "MdAutoFixHigh"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        kernel_in: str,
        padding: int,
    ) -> np.ndarray:
        kernel = np.stack([l.split() for l in kernel_in.splitlines()], axis=0).astype(
            float
        )

        kernel = np.flipud(np.fliplr(kernel))

        img = cv2.copyMakeBorder(
            img,
            top=padding,
            left=padding,
            right=padding,
            bottom=padding,
            borderType=cv2.BORDER_CONSTANT,
            value=0,
        )

        output = cv2.filter2D(img, -1, kernel)

        return output
