from __future__ import annotations

from enum import Enum
from math import ceil
from typing import Any, Optional

import numpy as np
from nodes.groups import if_enum_group, seed_group
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
from nodes.utils.seed import Seed
from nodes.utils.utils import get_h_w_c

from ...features import web_ui
from ...util import decode_base64_image, encode_base64_image, nearest_valid_size
from ...web_ui import (
    RESIZE_MODE_LABELS,
    SAMPLER_NAME_LABELS,
    STABLE_DIFFUSION_IMG2IMG_PATH,
    InpaintingFill,
    ResizeMode,
    SamplerName,
    get_api,
)
from .. import auto1111_group


class OutpaintingMethod(Enum):
    POOR_MAN_OUTPAINTING = 0
    OUTPAINTING_MK2 = 1


@auto1111_group.register(
    schema_id="chainner:external_stable_diffusion:img2img_outpainting",
    name="Outpaint",
    description='Outpaint an image using the "Poor man\'s outpainting" script from Automatic1111',
    icon="MdChangeCircle",
    inputs=[
        ImageInput().with_id(0),
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
        ),
        SliderInput(
            "Tile Width",
            minimum=64,
            default=512,
            maximum=2048,
            slider_step=8,
            controls_step=8,
        ),
        SliderInput(
            "Tile Height",
            minimum=64,
            default=512,
            maximum=2048,
            slider_step=8,
            controls_step=8,
        ),
        SliderInput(
            "Pixels to Expand",
            minimum=8,
            default=128,
            maximum=256,
            slider_step=8,
            controls_step=8,
        ).with_id(11),
        SliderInput(
            "Mask Blur",
            minimum=0,
            default=4,
            maximum=64,
        ),
        BoolInput("Extend Left", default=True).with_id(13),
        BoolInput("Extend Right", default=True).with_id(14),
        BoolInput("Extend Up", default=True).with_id(15),
        BoolInput("Extend Down", default=True).with_id(16),
        EnumInput(
            OutpaintingMethod, default=OutpaintingMethod.POOR_MAN_OUTPAINTING
        ).with_id(17),
        if_enum_group(17, OutpaintingMethod.POOR_MAN_OUTPAINTING)(
            EnumInput(InpaintingFill, default=InpaintingFill.FILL),
        ),
        if_enum_group(17, OutpaintingMethod.OUTPAINTING_MK2)(
            SliderInput(
                "Fall-off Exponent (lower=higher detail)",
                minimum=0,
                default=1,
                maximum=4,
                precision=2,
                slider_step=0.01,
                controls_step=0.01,
            ),
            SliderInput(
                "Color Variation",
                minimum=0,
                default=0.05,
                maximum=1,
                precision=2,
                slider_step=0.01,
                controls_step=0.01,
            ),
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                def nearest_valid(n: number) = ceil(n / 64) * 64;
                Image {
                    width: nearest_valid(
                        Input0.width
                        + if Input13 { Input11 } else { 0 }
                        + if Input14 { Input11 } else { 0 }
                    ),
                    height: nearest_valid(
                        Input0.height
                        + if Input15 { Input11 } else { 0 }
                        + if Input16 { Input11 } else { 0 }
                    ),
                }""",
            channels=3,
        ),
    ],
    decorators=[cached],
    features=web_ui,
    limited_to_8bpc=True,
)
def outpaint_node(
    image: np.ndarray,
    prompt: Optional[str],
    negative_prompt: Optional[str],
    denoising_strength: float,
    seed: Seed,
    steps: int,
    sampler_name: SamplerName,
    cfg_scale: float,
    resize_mode: ResizeMode,
    width: int,
    height: int,
    pixels_to_expand: int,
    mask_blur: int,
    extend_left: bool,
    extend_right: bool,
    extend_up: bool,
    extend_down: bool,
    outpainting_method: OutpaintingMethod,
    inpainting_fill: InpaintingFill,
    falloff_exponent: float,
    color_variation: float,
) -> np.ndarray:
    width, height = nearest_valid_size(width, height)

    expected_output_height, expected_output_width, _ = get_h_w_c(image)

    direction = []
    if extend_left:
        direction.append("left")
        expected_output_width += pixels_to_expand
    if extend_right:
        direction.append("right")
        expected_output_width += pixels_to_expand
    if extend_up:
        direction.append("up")
        expected_output_height += pixels_to_expand
    if extend_down:
        direction.append("down")
        expected_output_height += pixels_to_expand

    expected_output_width = int(ceil(expected_output_width / 64) * 64)
    expected_output_height = int(ceil(expected_output_height / 64) * 64)

    direction = ",".join(direction)
    request_data: dict[str, Any] = {
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
    }
    if outpainting_method == OutpaintingMethod.POOR_MAN_OUTPAINTING:
        request_data.update(
            {
                "script_name": "Poor man's outpainting",
                "script_args": list(
                    {
                        "pixels": pixels_to_expand,
                        "mask_blur": mask_blur,
                        "inpainting_fill": inpainting_fill.value,
                        "direction": direction,
                    }.values()
                ),
            }
        )

    if outpainting_method == OutpaintingMethod.OUTPAINTING_MK2:
        request_data.update(
            {
                "script_name": "Outpainting MK2",
                "script_args": list(
                    {
                        "_": "",
                        "pixels": pixels_to_expand,
                        "mask_blur": mask_blur,
                        "direction": direction,
                        "noise_q": falloff_exponent,
                        "color_variation": color_variation,
                    }.values()
                ),
            }
        )

    response = get_api().post(
        path=STABLE_DIFFUSION_IMG2IMG_PATH, json_data=request_data
    )
    result = decode_base64_image(response["images"][0])
    h, w, _ = get_h_w_c(result)
    assert (w, h) == (
        expected_output_width,
        expected_output_height,
    ), f"Expected the returned image to be {expected_output_width}x{expected_output_height}px but found {w}x{h}px instead "
    return result
