from __future__ import annotations

import cv2
import numpy as np
import pymatting

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import miscellaneous_group


@miscellaneous_group.register(
    schema_id="chainner:image:alpha_matting",
    name="Alpha Matting",
    description=[
        "Uses a trimap to separate foreground from background.",
        "Trimaps are a three-color image that categorize the input image into foreground (white), background (black), and undecided (gray). Alpha matting uses this information to separate the foreground from the background.",
        "A trimap typically has to be created manually, but it's typically an easy task since the trimaps don't have to detailed. The only requirements are that black pixels are the background, and white pixels are the foreground. The boundary region between foreground and background can be gray.",
        "The following image shows the input image (top left), its trimap (top right), the output alpha (bottom left), and the output image with a different background (bottom right):"
        "![lemur_at_the_beach.png](https://github.com/pymatting/pymatting/raw/master/data/lemur/lemur_at_the_beach.png)",
    ],
    icon="MdContentCut",
    see_also="chainner:onnx:rembg",
    inputs=[
        ImageInput(channels=[3, 4]).with_docs(
            "If the image has an alpha channel, it will be ignored."
        ),
        ImageInput("Trimap", channels=1),
        SliderInput(
            "Foreground Threshold", minimum=1, maximum=255, default=240
        ).with_docs(
            "All pixels in the trimap brighter than this value are considered to be part of the foreground."
        ),
        SliderInput(
            "Background Threshold", minimum=0, maximum=254, default=15
        ).with_docs(
            "All pixels in the trimap darker than this value are considered to be part of the background."
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let image = Input0;
                let trimap = Input1;
                let fg = Input2;
                let bg = Input3;

                if fg <= bg {
                    error("The foreground threshold must be greater than the background threshold.")
                } else if image.width != trimap.width or image.height != trimap.height {
                    error("The image and trimap must have the same size.")
                } else {
                    Image { width: image.width, height: image.height }
                }
            """,
            channels=4,
        ),
    ],
)
def alpha_matting_node(
    img: np.ndarray,
    trimap: np.ndarray,
    fg_threshold: int,
    bg_threshold: int,
) -> np.ndarray:
    assert (
        fg_threshold > bg_threshold
    ), "The foreground threshold must be greater than the background threshold."

    h, w, c = get_h_w_c(img)
    assert (h, w) == trimap.shape[:2], "The image and trimap must have the same size."

    # apply thresholding to trimap
    trimap = np.where(trimap > fg_threshold / 255, 1, trimap)
    trimap = np.where(trimap < bg_threshold / 255, 0, trimap)
    trimap = trimap.astype(np.float64)

    # convert to rgb
    if c == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
    else:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = img.astype(np.float64)

    assert img.dtype == np.float64
    assert trimap.dtype == np.float64
    alpha = pymatting.estimate_alpha_cf(img, trimap)
    foreground = pymatting.estimate_foreground_ml(img, alpha)
    assert isinstance(foreground, np.ndarray)

    # convert to bgr
    foreground = cv2.cvtColor(foreground, cv2.COLOR_RGB2BGR)
    return np.dstack((foreground, alpha))
