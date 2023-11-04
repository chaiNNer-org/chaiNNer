from __future__ import annotations

from typing import TYPE_CHECKING

from nodes.groups import seed_group
from nodes.node_cache import cached
from nodes.properties.inputs import (
    BoolInput,
    EnumInput,
    ImageInput,
    SeedInput,
    SliderInput,
    TextInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from ...features import web_ui
from ...util import decode_base64_image, encode_base64_image, nearest_valid_size
from ...web_ui import (
    RESIZE_MODE_LABELS,
    SAMPLER_NAME_LABELS,
    STABLE_DIFFUSION_IMG2IMG_PATH,
    ResizeMode,
    SamplerName,
    get_api,
)
from .. import auto1111_group

if TYPE_CHECKING:
    import numpy as np

    from nodes.utils.seed import Seed


@auto1111_group.register(
    schema_id="chainner:external_stable_diffusion:img2img",
    name="Image to Image",
    description="Modify an image using Automatic1111",
    icon="MdChangeCircle",
    inputs=[
        ImageInput(),
        TextInput("Prompt", multiline=True).make_optional(),
        TextInput("Negative Prompt", multiline=True).make_optional(),
        SliderInput(
            "Denoising Strength",
            minimum=0,
            default=0.75,
            maximum=1,
            slider_step=0.01,
            controls_step=0.1,
            precision=2,
        ),
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
        EnumInput(
            ResizeMode,
            default=ResizeMode.JUST_RESIZE,
            option_labels=RESIZE_MODE_LABELS,
        ).with_id(10),
        SliderInput(
            "Width",
            minimum=64,
            default=512,
            maximum=2048,
            slider_step=8,
            controls_step=8,
        ).with_id(8),
        SliderInput(
            "Height",
            minimum=64,
            default=512,
            maximum=2048,
            slider_step=8,
            controls_step=8,
        ).with_id(9),
        BoolInput("Seamless Edges", default=False),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                def nearest_valid(n: number) = floor(n / 8) * 8;
                Image {
                    width: nearest_valid(Input8),
                    height: nearest_valid(Input9)
                }""",
            channels=3,
        ),
    ],
    decorators=[cached],
    features=web_ui,
    limited_to_8bpc=True,
)
def image_to_image_node(
    image: np.ndarray,
    prompt: str | None,
    negative_prompt: str | None,
    denoising_strength: float,
    seed: Seed,
    steps: int,
    sampler_name: SamplerName,
    cfg_scale: float,
    resize_mode: ResizeMode,
    width: int,
    height: int,
    tiling: bool,
) -> np.ndarray:
    width, height = nearest_valid_size(
        width, height
    )  # This cooperates with the "image_type" of the ImageOutput
    request_data = {
        "init_images": [encode_base64_image(image)],
        "prompt": prompt or "",
        "negative_prompt": negative_prompt or "",
        "denoising_strength": denoising_strength,
        "seed": seed.to_u32(),
        "steps": steps,
        "sampler_name": sampler_name.value,
        "cfg_scale": cfg_scale,
        "width": width,
        "height": height,
        "resize_mode": resize_mode.value,
        "tiling": tiling,
    }
    response = get_api().post(
        path=STABLE_DIFFUSION_IMG2IMG_PATH, json_data=request_data
    )
    result = decode_base64_image(response["images"][0])
    h, w, _ = get_h_w_c(result)
    assert (
        (w, h) == (width, height)
    ), f"Expected the returned image to be {width}x{height}px but found {w}x{h}px instead "
    return result
