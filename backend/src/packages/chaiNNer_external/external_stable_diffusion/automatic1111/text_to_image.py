from __future__ import annotations

import numpy as np

from nodes.groups import seed_group
from nodes.node_cache import cached
from nodes.properties.inputs import (
    BoolInput,
    EnumInput,
    SeedInput,
    SliderInput,
    TextInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.seed import Seed
from nodes.utils.utils import get_h_w_c

from ...features import web_ui
from ...util import decode_base64_image, nearest_valid_size
from ...web_ui import (
    SAMPLER_NAME_LABELS,
    STABLE_DIFFUSION_TEXT2IMG_PATH,
    SamplerName,
    get_api,
)
from .. import auto1111_group


@auto1111_group.register(
    "chainner:external_stable_diffusion:txt2img",
    name="Text to Image",
    description="Generate an image using Automatic1111",
    icon="BsFillImageFill",
    inputs=[
        TextInput("Prompt", multiline=True).make_optional(),
        TextInput("Negative Prompt", multiline=True).make_optional(),
        seed_group(SeedInput()),
        SliderInput("Steps", minimum=1, default=20, maximum=150),
        EnumInput(
            SamplerName,
            default=SamplerName.EULER,
            option_labels=SAMPLER_NAME_LABELS,
        ),
        SliderInput(
            "CFG Scale",
            minimum=1,
            default=7,
            maximum=20,
            controls_step=0.1,
            precision=1,
        ),
        SliderInput(
            "Width",
            minimum=64,
            default=512,
            maximum=2048,
            slider_step=8,
            controls_step=8,
        ).with_id(6),
        SliderInput(
            "Height",
            minimum=64,
            default=512,
            maximum=2048,
            slider_step=8,
            controls_step=8,
        ).with_id(7),
        BoolInput("Seamless Edges", default=False),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                def nearest_valid(n: number) = floor(n / 8) * 8;
                Image {
                    width: nearest_valid(Input6),
                    height: nearest_valid(Input7)
                }""",
            channels=3,
        ),
    ],
    decorators=[cached],
    features=web_ui,
)
def text_to_image_node(
    prompt: str | None,
    negative_prompt: str | None,
    seed: Seed,
    steps: int,
    sampler_name: SamplerName,
    cfg_scale: float,
    width: int,
    height: int,
    tiling: bool,
) -> np.ndarray:
    # This cooperates with the "image_type" of the ImageOutput
    width, height = nearest_valid_size(width, height)
    request_data = {
        "prompt": prompt or "",
        "negative_prompt": negative_prompt or "",
        "seed": seed.to_u32(),
        "steps": steps,
        "sampler_name": sampler_name.value,
        "cfg_scale": cfg_scale,
        "width": width,
        "height": height,
        "tiling": tiling,
    }
    response = get_api().post(
        path=STABLE_DIFFUSION_TEXT2IMG_PATH, json_data=request_data
    )
    result = decode_base64_image(response["images"][0])
    h, w, _ = get_h_w_c(result)
    assert (
        (w, h) == (width, height)
    ), f"Expected the returned image to be {width}x{height}px but found {w}x{h}px instead "
    return result
