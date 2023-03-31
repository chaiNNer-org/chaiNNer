from __future__ import annotations

from enum import Enum
from typing import List

import cv2
import numpy as np

from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c, round_half_up

from .. import compositing_group


class Orientation(Enum):
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"


@compositing_group.register(
    schema_id="chainner:image:stack",
    name="Stack Images",
    description="Concatenate multiple images horizontally or vertically.",
    icon="CgMergeVertical",
    inputs=[
        ImageInput("Image A"),
        ImageInput("Image B").make_optional(),
        ImageInput("Image C").make_optional(),
        ImageInput("Image D").make_optional(),
        EnumInput(Orientation),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                def getWidth(img: Image | null) = match img { null => 0, _ as i => i.width };
                def getHeight(img: Image | null) = match img { null => 0, _ as i => i.height };
                def getChannels(img: Image | null) {
                    match img {
                        null => 0,
                        _ as i => match i.channels { 1 => 3, _ as c => c }
                    }
                }

                let maxWidth = max(Input0.width, getWidth(Input1), getWidth(Input2), getWidth(Input3));
                let maxHeight = max(Input0.height, getHeight(Input1), getHeight(Input2), getHeight(Input3));
                let maxChannels = max(Input0.channels, getChannels(Input1), getChannels(Input2), getChannels(Input3));

                def getAdjustedWidth(img: Image | null) {
                    match img {
                        null => 0,
                        _ as i => uint & round(i.width * maxHeight / i.height)
                    }
                }
                def getAdjustedHeight(img: Image | null) {
                    match img {
                        null => 0,
                        _ as i => uint & round(i.height * maxWidth / i.width)
                    }
                }

                let widthSum = getAdjustedWidth(Input0) + getAdjustedWidth(Input1) + getAdjustedWidth(Input2) + getAdjustedWidth(Input3);
                let heightSum = getAdjustedHeight(Input0) + getAdjustedHeight(Input1) + getAdjustedHeight(Input2) + getAdjustedHeight(Input3);

                Image {
                    width: match Input4 {
                        Orientation::Vertical => maxWidth,
                        Orientation::Horizontal => widthSum
                    },
                    height: match Input4 {
                        Orientation::Vertical => heightSum,
                        Orientation::Horizontal => maxHeight
                    },
                    channels: maxChannels
                }
                """
        )
    ],
)
def stack_node(
    im1: np.ndarray,
    im2: np.ndarray | None,
    im3: np.ndarray | None,
    im4: np.ndarray | None,
    orientation: Orientation,
) -> np.ndarray:
    img = im1
    imgs = []
    max_h, max_w, max_c = 0, 0, 1
    for img in im1, im2, im3, im4:
        if img is not None:
            h, w, c = get_h_w_c(img)
            if c == 1:
                img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
                c = 3
            max_h = max(h, max_h)
            max_w = max(w, max_w)
            max_c = max(c, max_c)
            imgs.append(img)

    fixed_imgs: List[np.ndarray] = []
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
            assert False, f"Invalid orientation '{orientation}'"

        # Expand channel dims if necessary
        if c < max_c:
            temp_img = np.ones((max_h, max_w, max_c))
            temp_img[:, :, :c] = fixed_img
            fixed_img = temp_img

        fixed_imgs.append(fixed_img.astype("float32"))

    if orientation == Orientation.HORIZONTAL:
        for i in range(len(fixed_imgs)):
            assert (
                fixed_imgs[i].shape[0] == fixed_imgs[0].shape[0]
            ), "Inputted heights are not the same and could not be auto-fixed"
            assert (
                fixed_imgs[i].dtype == fixed_imgs[0].dtype
            ), "The image types are not the same and could not be auto-fixed"
        img = cv2.hconcat(fixed_imgs)  # type: ignore
    elif orientation == Orientation.VERTICAL:
        for i in range(len(fixed_imgs)):
            assert (
                fixed_imgs[i].shape[1] == fixed_imgs[0].shape[1]
            ), "Inputted widths are not the same and could not be auto-fixed"
            assert (
                fixed_imgs[i].dtype == fixed_imgs[0].dtype
            ), "The image types are not the same and could not be auto-fixed"
        img = cv2.vconcat(fixed_imgs)  # type: ignore
    else:
        assert False, f"Invalid orientation '{orientation}'"

    return img
