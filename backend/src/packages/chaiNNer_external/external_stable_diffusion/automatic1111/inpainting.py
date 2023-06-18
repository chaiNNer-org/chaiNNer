from __future__ import annotations

from enum import Enum
from typing import Optional

import numpy as np

import navi
from nodes.groups import if_enum_group, seed_group
from nodes.impl.external_stable_diffusion import (
    RESIZE_MODE_LABELS,
    SAMPLER_NAME_LABELS,
    STABLE_DIFFUSION_IMG2IMG_PATH,
    InpaintingFill,
    ResizeMode,
    SamplerName,
    decode_base64_image,
    encode_base64_image,
    nearest_valid_size,
    post,
    verify_api_connection,
)
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

from .. import auto1111_group

verify_api_connection()


class InpaintArea(Enum):
    WHOLE_PICTURE = "WholePicture"
    ONLY_MASKED = "OnlyMasked"


@auto1111_group.register(
    schema_id="chainner:external_stable_diffusion:img2img_inpainting",
    name="Inpaint",
    description="Modify a masked part of an image using Automatic1111",
    icon="MdChangeCircle",
    inputs=[
        ImageInput(),
        ImageInput("Mask", channels=1, image_type=navi.Image(size_as="Input0")),
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
            default_value=SamplerName.EULER,
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
            default_value=ResizeMode.JUST_RESIZE,
            option_labels=RESIZE_MODE_LABELS,
        ),
        SliderInput(
            "Width",
            minimum=64,
            default=512,
            maximum=2048,
            slider_step=8,
            controls_step=8,
        ),
        SliderInput(
            "Height",
            minimum=64,
            default=512,
            maximum=2048,
            slider_step=8,
            controls_step=8,
        ),
        BoolInput("Seamless Edges", default=False),
        SliderInput(
            "Mask Blur",
            minimum=0,
            default=4,
            maximum=64,
            unit="px",
        ),
        EnumInput(InpaintingFill, default_value=InpaintingFill.ORIGINAL),
        EnumInput(InpaintArea, default_value=InpaintArea.WHOLE_PICTURE),
        if_enum_group(15, InpaintArea.ONLY_MASKED)(
            SliderInput(
                "Only masked padding",
                minimum=0,
                default=32,
                maximum=256,
                slider_step=4,
                controls_step=4,
                unit="px",
            ),
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""def nearest_valid(n: number) = int & floor(n / 8) * 8;
                Image {
                    width: if Input15==InpaintArea::OnlyMasked {Input0.width} else {nearest_valid(Input10)},
                    height: if Input15==InpaintArea::OnlyMasked {Input0.height} else {nearest_valid(Input11)}
                }""",
            channels=3,
        ),
    ],
    decorators=[cached],
)
def img2img_inpainting_node(
    image: np.ndarray,
    mask: np.ndarray,
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
    tiling: bool,
    mask_blur: int,
    inpainting_fill: InpaintingFill,
    inpaint_area: InpaintArea,
    inpaint_full_res_padding: int,
) -> np.ndarray:
    width, height = nearest_valid_size(
        width, height
    )  # This cooperates with the "image_type" of the ImageOutput
    request_data = {
        "init_images": [encode_base64_image(image)],
        "mask": encode_base64_image(mask),
        "inpainting_fill": inpainting_fill.value,
        "mask_blur": mask_blur,
        "inpaint_full_res": inpaint_area == InpaintArea.ONLY_MASKED,
        "inpaint_full_res_padding": inpaint_full_res_padding,
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
    response = post(path=STABLE_DIFFUSION_IMG2IMG_PATH, json_data=request_data)
    result = decode_base64_image(response["images"][0])
    h, w, _ = get_h_w_c(result)
    if inpaint_area == InpaintArea.ONLY_MASKED:
        in_h, in_w, _ = get_h_w_c(image)
        assert (w, h) == (
            in_w,
            in_h,
        ), f"Expected the returned image to be {in_w}x{in_h}px but found {w}x{h}px instead "
    else:
        assert (w, h) == (
            width,
            height,
        ), f"Expected the returned image to be {width}x{height}px but found {w}x{h}px instead "
    return result
