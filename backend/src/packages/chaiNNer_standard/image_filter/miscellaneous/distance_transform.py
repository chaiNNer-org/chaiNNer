from __future__ import annotations

import cv2
import numpy as np

from nodes.impl.dithering.common import dtype_to_uint8
from nodes.impl.image_utils import as_3d
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


@miscellaneous_group.register(
    schema_id="chainner:image:distance_transform",
    name="Distance Transform",
    description="Perform a distance transform on a monochrome bitmap image, producing a signed distance field.",
    icon="MdBlurOff",
    inputs=[
        ImageInput(channels=1),
        NumberInput("Spread", minimum=1, default=4),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def distance_transform_node(img: np.ndarray, spread: int) -> np.ndarray:
    img = as_3d(dtype_to_uint8(img))
    img[img < 128] = 0
    img[img >= 128] = 255

    black_dist = np.empty(shape=img.shape, dtype=np.float32)
    white_dist = np.empty(shape=img.shape, dtype=np.float32)

    cv2.distanceTransform(
        src=img,
        distanceType=cv2.DIST_L2,
        maskSize=5,
        dst=black_dist,
        dstType=cv2.CV_32F,
    )
    cv2.distanceTransform(
        src=255 - img,
        distanceType=cv2.DIST_L2,
        maskSize=5,
        dst=white_dist,
        dstType=cv2.CV_32F,
    )

    img1 = img.ravel()
    signed_distance = np.empty(shape=img.shape, dtype=np.float32).ravel()

    signed_distance[img1 == 255] = black_dist.ravel()[img1 == 255] / spread / 2 + 0.5
    signed_distance[img1 == 0] = 0.5 - white_dist.ravel()[img1 == 0] / spread / 2

    signed_distance = np.clip(signed_distance, 0, 1)

    return signed_distance.reshape(img.shape)
