from __future__ import annotations

import numpy as np

from nodes.node_cache import cached
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import TextOutput

from ...web_ui import STABLE_DIFFUSION_INTERROGATE_PATH, encode_base64_image, post
from .. import auto1111_group


@auto1111_group.register(
    schema_id="chainner:external_stable_diffusion:interrograte",
    name="CLIP Interrogate",
    description="Use Automatic1111 to get a description of an image",
    icon="MdTextFields",
    inputs=[
        ImageInput(),
    ],
    outputs=[
        TextOutput("Text"),
    ],
    decorators=[cached],
    features="webui",
)
def clip_interrogate_node(image: np.ndarray) -> str:
    request_data = {
        "image": encode_base64_image(image),
    }
    response = post(path=STABLE_DIFFUSION_INTERROGATE_PATH, json_data=request_data)
    return response["caption"]
