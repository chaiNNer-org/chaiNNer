from __future__ import annotations

from enum import Enum

import cv2
import numpy as np

from nodes.groups import optional_list_group
from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import ALPHABET, get_h_w_c, round_half_up

from .. import compositing_group


class Orientation(Enum):
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"


@compositing_group.register(
    schema_id="chainner:image:stack",
    name="Stack Images",
    description="Concatenate (stack) multiple images horizontally or vertically.",
    icon="CgMergeVertical",
    inputs=[
        EnumInput(Orientation).with_id(4),
        ImageInput("Image A").with_id(0),
        ImageInput("Image B").make_optional().with_id(1),
        optional_list_group(
            ImageInput("Image C").make_optional().with_id(2),
            ImageInput("Image D").make_optional().with_id(3),
            *[
                ImageInput(f"Image {letter}").make_optional()
                for letter in ALPHABET[4:14]
            ],
        ),
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

                let maxWidth = max(
                    Input0.width,
                    getWidth(Input1),
                    getWidth(Input2),
                    getWidth(Input3),
                    getWidth(Input5),
                    getWidth(Input6),
                    getWidth(Input7),
                    getWidth(Input8),
                    getWidth(Input9),
                    getWidth(Input10),
                    getWidth(Input11),
                    getWidth(Input12),
                    getWidth(Input13),
                    getWidth(Input14)
                );
                let maxHeight = max(
                    Input0.height,
                    getHeight(Input1),
                    getHeight(Input2),
                    getHeight(Input3),
                    getHeight(Input5),
                    getHeight(Input6),
                    getHeight(Input7),
                    getHeight(Input8),
                    getHeight(Input9),
                    getHeight(Input10),
                    getHeight(Input11),
                    getHeight(Input12),
                    getHeight(Input13),
                    getHeight(Input14)
                );
                let maxChannels = max(
                    Input0.channels,
                    getChannels(Input1),
                    getChannels(Input2),
                    getChannels(Input3),
                    getChannels(Input5),
                    getChannels(Input6),
                    getChannels(Input7),
                    getChannels(Input8),
                    getChannels(Input9),
                    getChannels(Input10),
                    getChannels(Input11),
                    getChannels(Input12),
                    getChannels(Input13),
                    getChannels(Input14)
                );

                def getAdjustedWidth(img: Image | null) {
                    match img {
                        null => 0,
                        _ as i => int(1..) & round(i.width * maxHeight / i.height)
                    }
                }
                def getAdjustedHeight(img: Image | null) {
                    match img {
                        null => 0,
                        _ as i => int(1..) & round(i.height * maxWidth / i.width)
                    }
                }

                let widthSum =
                    getAdjustedWidth(Input0)
                    + getAdjustedWidth(Input1)
                    + getAdjustedWidth(Input2)
                    + getAdjustedWidth(Input3)
                    + getAdjustedWidth(Input5)
                    + getAdjustedWidth(Input6)
                    + getAdjustedWidth(Input7)
                    + getAdjustedWidth(Input8)
                    + getAdjustedWidth(Input9)
                    + getAdjustedWidth(Input10)
                    + getAdjustedWidth(Input11)
                    + getAdjustedWidth(Input12)
                    + getAdjustedWidth(Input13)
                    + getAdjustedWidth(Input14);
                let heightSum =
                    getAdjustedHeight(Input0)
                    + getAdjustedHeight(Input1)
                    + getAdjustedHeight(Input2)
                    + getAdjustedHeight(Input3)
                    + getAdjustedHeight(Input5)
                    + getAdjustedHeight(Input6)
                    + getAdjustedHeight(Input7)
                    + getAdjustedHeight(Input8)
                    + getAdjustedHeight(Input9)
                    + getAdjustedHeight(Input10)
                    + getAdjustedHeight(Input11)
                    + getAdjustedHeight(Input12)
                    + getAdjustedHeight(Input13)
                    + getAdjustedHeight(Input14);

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
def stack_images_node(
    orientation: Orientation,
    image_a: np.ndarray,
    *other_images: np.ndarray | None,
) -> np.ndarray:
    imgs = []
    max_h, max_w, max_c = 0, 0, 1
    for img in [image_a, *other_images]:
        if img is not None:
            h, w, c = get_h_w_c(img)
            if c == 1:
                img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)  # noqa
                c = 3
            max_h = max(h, max_h)
            max_w = max(w, max_w)
            max_c = max(c, max_c)
            imgs.append(img)

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
            assert False, f"Invalid orientation '{orientation}'"

        # Expand channel dims if necessary
        if c < max_c:
            temp_img = np.ones((max_h, max_w, max_c), dtype=np.float32)
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
        return cv2.hconcat(fixed_imgs)
    elif orientation == Orientation.VERTICAL:
        for i in range(len(fixed_imgs)):
            assert (
                fixed_imgs[i].shape[1] == fixed_imgs[0].shape[1]
            ), "Inputted widths are not the same and could not be auto-fixed"
            assert (
                fixed_imgs[i].dtype == fixed_imgs[0].dtype
            ), "The image types are not the same and could not be auto-fixed"
        return cv2.vconcat(fixed_imgs)
