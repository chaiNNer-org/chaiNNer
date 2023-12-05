from __future__ import annotations

from enum import Enum

import cv2
import numpy as np
import pymatting

import navi
from nodes.groups import if_enum_group, linked_inputs_group
from nodes.impl.color.color import Color
from nodes.properties.inputs import (
    BoolInput,
    ColorInput,
    EnumInput,
    ImageInput,
    SliderInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from . import node_group


class KeyMethod(Enum):
    BINARY = 1
    TRIMAP_MATTING = 2


@node_group.register(
    schema_id="chainner:image:chroma_key",
    name="Chroma Key",
    description=[
        "Removes a color from an image and replaces it with transparency.",
        "To set he key color, either define a constant color with the `chainner:utility:color` node or pick a color from the image with the `chainner:image:pick_color` node.",
        "This nodes offers multiple strategies to key the image:",
        "- **Binary**:",
        "    A simple binary thresholding method is used to determine the whether a pixel in the image is transparent or not. This method is mostly useful images *without anti-aliasing*.",
        "- **Trimap matting**:",
        "    This method uses a separate threshold for foreground (FG) and background (BG) to create a trimap. Alpha matting is then performed on the trimap to create the final alpha. For more information on alpha matting, see the `chainner:image:alpha_matting` node.",
        "    The confusion sliders can be used to reduce the amount of pixels that are considered to be FG or BG. This is useful for anti-alised/blurred edges.",
        "    Since alpha matting can be slow, it is recommended to use the **Output Trimap** option. This option will use the trimap for alpha directly, without performing alpha matting. Using the fast preview, you can tweak the other parameters to generate a good trimap. Once you are satisfied with the trimap, you can disable the **Output Trimap** option to perform alpha matting.",
    ],
    icon="MdOutlineFormatColorFill",
    inputs=[
        ImageInput(channels=3),
        ColorInput(channels=3),
        EnumInput(KeyMethod).with_id(2),
        if_enum_group(2, KeyMethod.BINARY)(
            SliderInput(
                "Threshold", maximum=100, default=1, precision=1, controls_step=1
            )
        ),
        if_enum_group(2, KeyMethod.TRIMAP_MATTING)(
            SliderInput(
                "Threshold BG", maximum=100, default=2, precision=1, controls_step=1
            ),
            SliderInput(
                "Threshold FG", maximum=100, default=10, precision=1, controls_step=1
            ),
            linked_inputs_group(
                SliderInput("Confusion BG", maximum=100, default=4, scale="log"),
                SliderInput("Confusion FG", maximum=100, default=4, scale="log"),
            ),
            BoolInput("Output Trimap", default=False).with_docs(
                "If enabled, the generated trimap will be used as alpha. No alpha matting will be performed."
            ),
        ),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(size_as="Input0"),
            channels=4,
        ),
    ],
)
def chroma_key_node(
    img: np.ndarray,
    key_color: Color,
    method: KeyMethod,
    binary_threshold: float,
    tm_threshold_bg: float,
    tm_threshold_fg: float,
    tm_confusion_bg: int,
    tm_confusion_fg: int,
    tm_output_trimap: bool,
) -> np.ndarray:
    if method == KeyMethod.BINARY:
        return binary_keying(img, key_color, binary_threshold / 100)
    elif method == KeyMethod.TRIMAP_MATTING:
        return trimap_matting_keying(
            img,
            key_color,
            tm_threshold_bg / 100,
            tm_threshold_fg / 100,
            tm_confusion_bg,
            tm_confusion_fg,
            tm_output_trimap,
        )
    else:
        raise AssertionError(f"Invalid alpha fill method {method}")


def binary_keying(img: np.ndarray, key_color: Color, threshold: float) -> np.ndarray:
    h, w, _ = get_h_w_c(img)

    diff = np.abs(img - key_color.to_image(w, h))
    diff = np.sum(diff, axis=-1) / 3

    alpha = np.where(diff > threshold, 1, 0).astype(np.float32)
    return np.dstack([img, alpha])


def trimap_matting_keying(
    img: np.ndarray,
    key_color: Color,
    threshold_bg: float,
    threshold_fg: float,
    confusion_bg: int,
    confusion_fg: int,
    output_trimap: bool,
) -> np.ndarray:
    h, w, _ = get_h_w_c(img)

    diff = np.abs(img - key_color.to_image(w, h))
    diff = np.sum(diff, axis=-1) / 3

    # determine in and out
    bg_mask = np.where(diff <= threshold_bg, 255, 0).astype(np.uint8)
    fg_mask = np.where(diff > threshold_fg, 255, 0).astype(np.uint8)
    if confusion_bg > 0:
        element = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (2 * confusion_bg + 1,) * 2
        )
        cv2.erode(bg_mask, element, iterations=1, dst=bg_mask)
    if confusion_fg > 0:
        element = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (2 * confusion_fg + 1,) * 2
        )
        cv2.erode(fg_mask, element, iterations=1, dst=fg_mask)

    # must be float64
    trimap = np.full((h, w), 0.5, dtype=np.float64)
    trimap[bg_mask > 128] = 0
    trimap[fg_mask > 128] = 1

    if output_trimap:
        return np.dstack((img, trimap.astype(np.float32)))

    # convert to rgb
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = img.astype(np.float64)

    assert img.dtype == np.float64
    assert trimap.dtype == np.float64
    alpha = pymatting.estimate_alpha_cf(img, trimap)
    foreground = pymatting.estimate_foreground_ml(img, alpha)
    assert isinstance(foreground, np.ndarray)

    # convert to bgr
    foreground = cv2.cvtColor(foreground, cv2.COLOR_RGB2BGR)
    return np.dstack(
        (
            foreground.astype(np.float32),
            alpha.astype(np.float32),
        )
    )
