from __future__ import annotations

import cv2
import numpy as np

from ...impl.dithering.common import dtype_to_uint8
from ...impl.image_utils import as_3d
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from . import category as ImageFilterCategory


@NodeFactory.register("chainner:image:distance_transform")
class DistanceTransformNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Perform a distance transform on a monochrome bitmap image, producing a signed distance field."
        self.inputs = [
            ImageInput(channels=1),
            NumberInput("Spread", minimum=1, default=4),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Distance Transform"
        self.icon = "MdBlurOff"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray, spread: int) -> np.ndarray:
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

        signed_distance[img1 == 255] = (
            black_dist.ravel()[img1 == 255] / spread / 2 + 0.5
        )
        signed_distance[img1 == 0] = 0.5 - white_dist.ravel()[img1 == 0] / spread / 2

        signed_distance = np.clip(signed_distance, 0, 1)

        return signed_distance.reshape(img.shape)
