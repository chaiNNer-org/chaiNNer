from __future__ import annotations

import base64
import hashlib
from typing import Tuple

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import TextOutput

from .. import miscellaneous_group


@miscellaneous_group.register(
    schema_id="chainner:image:generate_hash",
    name="Generate Hash",
    description="Generate a hash from an image using the BLAKE2b hashing algorithm.",
    icon="MdCalculate",
    inputs=[
        ImageInput(),
        SliderInput(
            "Digest Size (in bytes)",
            minimum=1,
            maximum=64,
            default=8,
            precision=1,
            controls_step=1,
        ),
    ],
    outputs=[
        TextOutput("Hex", output_type="string"),
        TextOutput("Base64", output_type="string"),
    ],
)
def run(img: np.ndarray, size: int) -> Tuple[str, str]:
    """Generate a hash from the input image. The digest size determines the length of the hash that is output."""
    h = hashlib.blake2b(img, digest_size=size)  # type: ignore
    return h.hexdigest(), base64.urlsafe_b64encode(h.digest()).decode("utf-8")
