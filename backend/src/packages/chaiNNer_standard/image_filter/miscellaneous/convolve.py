from __future__ import annotations

import cv2
import numpy as np

from nodes.properties.inputs import ImageInput, NumberInput, TextInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


@miscellaneous_group.register(
    schema_id="chainner:image:image_convolve",
    name="Convolve",
    description="Convolves input image with input kernel",
    icon="MdAutoFixHigh",
    inputs=[
        ImageInput("Image"),
        TextInput("Kernel String", multiline=True, has_handle=False, min_length=1),
        NumberInput("Padding", minimum=0, default=0),
    ],
    outputs=[
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
    ],
)
def convolve_node(
    img: np.ndarray,
    kernel_in: str,
    padding: int,
) -> np.ndarray:
    kernel = np.stack([l.split() for l in kernel_in.splitlines()], axis=0).astype(float)

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
