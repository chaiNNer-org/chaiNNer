from __future__ import annotations

import numpy as np
from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import crop_group


@crop_group.register(
    schema_id="chainner:image:crop_content",
    name="Crop to Content",
    description=(
        "Crop an image to the boundaries of the visible image content, "
        "removing borders at or below the given opacity threshold."
    ),
    icon="MdCrop",
    inputs=[
        ImageInput(),
        SliderInput(
            "Threshold",
            precision=1,
            controls_step=1,
            slider_step=1,
            default=0,
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                match Input0.channels {
                    ..3 => Input0,
                    _ => Image {
                        width: min(uint, Input0.width) & 1..,
                        height: min(uint, Input0.height) & 1..,
                        channels: Input0.channels
                    }
                }
                """,
            assume_normalized=True,
        )
    ],
)
def crop_to_content_node(img: np.ndarray, thresh_val: float) -> np.ndarray:
    c = get_h_w_c(img)[2]
    if c < 4:
        return img

    # Threshold value 100 guarantees an empty image, so make sure the max
    # is just below that.
    thresh_val = min(thresh_val / 100, 0.99999)

    # Valid alpha is greater than threshold, else impossible to crop 0 alpha only
    alpha = img[:, :, 3]
    r = np.any(alpha > thresh_val, 1)
    if r.any():
        h, w, _ = get_h_w_c(img)
        c = np.any(alpha > thresh_val, 0)
        imgout = np.copy(img)[
            r.argmax() : h - r[::-1].argmax(), c.argmax() : w - c[::-1].argmax()
        ]
    else:
        raise RuntimeError("Crop results in empty image.")

    return imgout
