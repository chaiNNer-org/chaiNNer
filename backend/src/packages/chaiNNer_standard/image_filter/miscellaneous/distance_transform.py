from __future__ import annotations

from enum import Enum

import cv2
import numpy as np
from chainner_ext import esdf, edtaa

from nodes.impl.image_utils import as_3d, to_uint8
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


class DistanceAlgorithm(Enum):
    BINARY = 1
    ESDF = 2
    EDTAA3 = 3
    EDTAA4 = 4


def binary_sdf(img: np.ndarray, spread: float, cutoff: float) -> np.ndarray:
    out = as_3d(img.copy())
    img = to_uint8(out[:, :, -1], normalized=True)
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

    signed_distance[img1 == 255] = black_dist.ravel()[img1 == 255] / spread / 2 + cutoff
    signed_distance[img1 == 0] = cutoff - white_dist.ravel()[img1 == 0] / spread / 2

    signed_distance = np.clip(signed_distance, 0, 1)
    out[:, :, -1] = signed_distance.reshape(img.shape)
    return out


@miscellaneous_group.register(
    schema_id="chainner:image:distance_transform",
    name="Distance Transform",
    description="Perform a distance transform on a monochrome bitmap image, producing a signed distance field.",
    icon="MdBlurOff",
    inputs=[
        ImageInput(),
        NumberInput("Spread", min=1, default=4),
        SliderInput("Cutoff", min=0, default=0.5, max=1, precision=2),
        EnumInput(DistanceAlgorithm, option_labels={
            DistanceAlgorithm.ESDF: 'ESDF',
            DistanceAlgorithm.EDTAA3: 'EDTAA3',
            DistanceAlgorithm.EDTAA4: 'EDTAA4',
        }
        ).with_docs(
            "If Binary is selected, then the image will be converted to binary (either black or white) before processing.",
            "Choosing ESDF or EDTAA will significantly improve the results of anti-aliased shapes, but it cannot be used on anything else. It assumes strictly binary shapes (with optional anti-aliasing), and will return incorrect results for e.g. blurry images. If you cannot guarantee binary image, use the `chainner:image:threshold` node with *Anti-aliasing* enabled.",
            "If an RGBA image is passed in the ESDF and EDTAA algorithms will also use the results of the distance transform to generate an alpha-filled image in the RGB color channels"
            "Sub-pixel distance transform is implemented using the excellent [ESDF algorithm](https://acko.net/blog/subpixel-distance-transform/) by Steven Wittens and [EDTAA algorithm](https://www.itn.liu.se/~stegu76/edtaa/) by Stefan Gustavson.",
        ),
    ],
    outputs=[ImageOutput(shape_as=0)],
)
def distance_transform_node(
    img: np.ndarray,
    spread: int,
    cutoff: float,
    algorithm: DistanceAlgorithm,
) -> np.ndarray:
    if algorithm == DistanceAlgorithm.ESDF:
        return esdf(img, spread * 2, cutoff, False, True)
    if algorithm == DistanceAlgorithm.EDTAA3:
        return edtaa(img, spread * 2, cutoff, True, False)
    if algorithm == DistanceAlgorithm.EDTAA4:
        return edtaa(img, spread * 2, cutoff, False, True)
    else:
        return binary_sdf(img, spread, cutoff)
