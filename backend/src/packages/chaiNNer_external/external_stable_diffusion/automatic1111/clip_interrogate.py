from __future__ import annotations

from typing import TYPE_CHECKING

from nodes.node_cache import cached
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import TextOutput

from ...features import web_ui
from ...util import encode_base64_image
from ...web_ui import STABLE_DIFFUSION_INTERROGATE_PATH, get_api
from .. import auto1111_group

if TYPE_CHECKING:
    import numpy as np


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
    features=web_ui,
)
def clip_interrogate_node(image: np.ndarray) -> str:
    request_data = {
        "image": encode_base64_image(image),
    }
    response = get_api().post(
        path=STABLE_DIFFUSION_INTERROGATE_PATH, json_data=request_data
    )
    return response["caption"]
