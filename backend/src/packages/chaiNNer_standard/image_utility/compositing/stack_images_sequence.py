from __future__ import annotations

from enum import Enum

import cv2
import numpy as np

from api import Collector, IteratorInputInfo
from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c, round_half_up

from .. import compositing_group


class Orientation(Enum):
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"


@compositing_group.register(
    schema_id="chainner:image:stack_images_sequence",
    name="Stack Images (Sequence)",
    description=[
        "Collects all images from a sequence and stacks them horizontally or vertically.",
        "This is useful for combining multiple images from iterations into a single stacked image.",
    ],
    icon="CgMergeVertical",
    kind="collector",
    inputs=[
        ImageInput("Image Sequence"),
        EnumInput(Orientation).with_id(1),
    ],
    iterator_inputs=IteratorInputInfo(inputs=0),
    outputs=[
        ImageOutput(
            image_type="""
                Image {
                    width: int(1..),
                    height: int(1..),
                    channels: 1 | 3 | 4
                }
                """
        )
    ],
)
def stack_images_sequence_node(
    _: None, orientation: Orientation
) -> Collector[np.ndarray, np.ndarray]:
    images: list[np.ndarray] = []

    def on_iterate(img: np.ndarray):
        images.append(img)

    def on_complete() -> np.ndarray:
        if len(images) == 0:
            raise ValueError("No images in sequence to stack")

        if len(images) == 1:
            return images[0]

        # Find max dimensions and channels
        max_h, max_w, max_c = 0, 0, 1
        imgs: list[np.ndarray] = []
        for img in images:
            _img = img
            h, w, c = get_h_w_c(img)
            if c == 1:
                _img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
                c = 3
            max_h = max(h, max_h)
            max_w = max(w, max_w)
            max_c = max(c, max_c)
            imgs.append(_img)

        fixed_imgs: list[np.ndarray] = []
        for img in imgs:
            h, w, c = get_h_w_c(img)

            fixed_img = img
            # Fix images so they resize proportionally to the max image
            if orientation == Orientation.HORIZONTAL:
                if h < max_h:
                    fixed_img = cv2.resize(
                        img,
                        (round_half_up(w * max_h / h), max_h),
                        interpolation=cv2.INTER_NEAREST,
                    )
            elif orientation == Orientation.VERTICAL:
                if w < max_w:
                    fixed_img = cv2.resize(
                        img,
                        (max_w, round_half_up(h * max_w / w)),
                        interpolation=cv2.INTER_NEAREST,
                    )
            else:
                raise AssertionError(f"Invalid orientation '{orientation}'")

            # Expand channel dims if necessary
            if c < max_c:
                new_h, new_w, _ = get_h_w_c(fixed_img)
                temp_img = np.ones((new_h, new_w, max_c), dtype=np.float32)
                temp_img[:, :, :c] = fixed_img
                fixed_img = temp_img

            fixed_imgs.append(fixed_img.astype("float32"))

        if orientation == Orientation.HORIZONTAL:
            for i in range(len(fixed_imgs)):
                assert fixed_imgs[i].shape[0] == fixed_imgs[0].shape[0], (
                    "Inputted heights are not the same and could not be auto-fixed"
                )
                assert fixed_imgs[i].dtype == fixed_imgs[0].dtype, (
                    "The image types are not the same and could not be auto-fixed"
                )
            return cv2.hconcat(fixed_imgs)
        elif orientation == Orientation.VERTICAL:
            for i in range(len(fixed_imgs)):
                assert fixed_imgs[i].shape[1] == fixed_imgs[0].shape[1], (
                    "Inputted widths are not the same and could not be auto-fixed"
                )
                assert fixed_imgs[i].dtype == fixed_imgs[0].dtype, (
                    "The image types are not the same and could not be auto-fixed"
                )
            return cv2.vconcat(fixed_imgs)

        raise AssertionError(f"Invalid orientation '{orientation}'")

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
