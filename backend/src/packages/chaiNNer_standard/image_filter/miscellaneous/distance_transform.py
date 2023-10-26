from __future__ import annotations

import cv2
import numpy as np
from chainner_ext import esdf
from nodes.impl.image_utils import as_3d, to_uint8
from nodes.properties.inputs import BoolInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


def binary_sdf(img: np.ndarray, spread: float) -> np.ndarray:
    img = as_3d(to_uint8(img, normalized=True))
    img[img < 128] = 0
    img[img >= 128] = 255

    black_dist = np.empty(shape=img.shape, dtype=np.float32)
    white_dist = np.empty(shape=img.shape, dtype=np.float32)

    cv2.distanceTransform(
        src=img,
        distanceType=cv2.DIST_L2,
        maskSize=5,
        dst=black_dist,
        dstType=cv2.CV_32F,  # type: ignore
    )
    cv2.distanceTransform(
        src=255 - img,
        distanceType=cv2.DIST_L2,
        maskSize=5,
        dst=white_dist,
        dstType=cv2.CV_32F,  # type: ignore
    )

    img1 = img.ravel()
    signed_distance = np.empty(shape=img.shape, dtype=np.float32).ravel()

    signed_distance[img1 == 255] = black_dist.ravel()[img1 == 255] / spread / 2 + 0.5
    signed_distance[img1 == 0] = 0.5 - white_dist.ravel()[img1 == 0] / spread / 2

    signed_distance = np.clip(signed_distance, 0, 1)

    return signed_distance.reshape(img.shape)


@miscellaneous_group.register(
    schema_id="chainner:image:distance_transform",
    name="Distance Transform",
    description="Perform a distance transform on a monochrome bitmap image, producing a signed distance field.",
    icon="MdBlurOff",
    inputs=[
        ImageInput(channels=1),
        NumberInput("Spread", minimum=1, default=4),
        BoolInput("Sub-pixel precision", default=False).with_docs(
            "If enabled, then anti-aliasing will be accounted for. If not enabled, then the image will be converted to binary (either black or white) before processing.",
            "Enabling this option will significantly improve the results of anti-aliased shapes, but it cannot be used on anything else. It assumes strictly binary shapes (with optional anti-aliasing), and will return incorrect results for e.g. blurry images. If you cannot guarantee binary image, use the `chainner:image:threshold` node with *Anti-aliasing* enabled.",
            "Sub-pixel distance transform is implemented using the excellent [ESDF algorithm](https://acko.net/blog/subpixel-distance-transform/) by Steven Wittens.",
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def distance_transform_node(
    img: np.ndarray,
    spread: int,
    use_esdf: bool,
) -> np.ndarray:
    if use_esdf:
        return esdf(img, spread * 2, 0.5, False, True)
    return binary_sdf(img, spread)
