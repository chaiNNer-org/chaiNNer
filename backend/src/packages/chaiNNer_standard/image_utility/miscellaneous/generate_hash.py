from __future__ import annotations

import base64
import hashlib

import numpy as np

from nodes.impl.image_utils import to_uint8
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
        SliderInput("Digest Size (in bytes)", min=1, max=64, default=8).with_docs(
            "The digest size determines the length of the hash that is returned."
        ),
    ],
    outputs=[
        TextOutput("Hex"),
        TextOutput("Base64"),
    ],
)
def generate_hash_node(img: np.ndarray, size: int) -> tuple[str, str]:
    img = np.ascontiguousarray(to_uint8(img))
    h = hashlib.blake2b(img, digest_size=size)  # type: ignore
    return h.hexdigest(), base64.urlsafe_b64encode(h.digest()).decode("utf-8")
