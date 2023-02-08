from __future__ import annotations

from math import ceil
from typing import Optional

import numpy as np

from . import category as ExternalStableDiffusionCategory
from ...impl.external_stable_diffusion import (
    decode_base64_image,
    SamplerName,
    STABLE_DIFFUSION_IMG2IMG_URL,
    post,
    encode_base64_image,
    nearest_valid_size, ResizeMode, RESIZE_MODE_LABELS, InpaintingFill,
)
from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import (
    TextInput,
    NumberInput,
    SliderInput,
    EnumInput,
    ImageInput, BoolInput,
)
from ...properties.outputs import ImageOutput
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:external_stable_diffusion:img2img_outpainting")
class Img2ImgOutpainting(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Outpaint an image using the \"Poor man's outpainting\" script from Automatic1111"
        self.inputs = [
            ImageInput().with_id(0),
            TextInput("Prompt", default="an astronaut riding a horse"),
            TextInput("Negative Prompt").make_optional(),
            SliderInput(
                "Denoising Strength",
                minimum=0,
                default=0.75,
                maximum=1,
                slider_step=0.01,
                controls_step=0.1,
                precision=2,
            ),
            group("seed")(
                NumberInput("Seed", minimum=0, default=42, maximum=4294967296)
            ),
            SliderInput("Steps", minimum=1, default=20, maximum=150),
            EnumInput(SamplerName, default_value=SamplerName.EULER),
            SliderInput(
                "CFG Scale",
                minimum=1,
                default=7,
                maximum=20,
                controls_step=0.1,
                precision=1,
            ),
            EnumInput(ResizeMode, default_value=ResizeMode.JUST_RESIZE, option_labels=RESIZE_MODE_LABELS),
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
            EnumInput(InpaintingFill, default_value=InpaintingFill.FILL),
            BoolInput("Extend Left", default=True).with_id(14),
            BoolInput("Extend Right", default=True).with_id(15),
            BoolInput("Extend Up", default=True).with_id(16),
            BoolInput("Extend Down", default=True).with_id(17),
        ]

        # target_w = math.ceil((init_img.width + left + right) / 64) * 64
        # target_h = math.ceil((init_img.height + up + down) / 64) * 64

        self.outputs = [
            ImageOutput(
                image_type="""def nearest_valid(n: number) = int & ceil(n / 64) * 64;
                Image {
                    width: nearest_valid(
                        Input0.width
                        + if Input14 { Input11 } else { 0 }
                        + if Input15 { Input11 } else { 0 }
                    ),
                    height: nearest_valid(
                        Input0.height
                        + if Input16 { Input11 } else { 0 }
                        + if Input17 { Input11 } else { 0 }
                    ),
                }""",
                channels=3,
            ),
        ]

        self.category = ExternalStableDiffusionCategory
        self.name = "Outpaint"
        self.icon = "MdChangeCircle"
        self.sub = "Automatic1111"

    def run(
            self,
            image: np.ndarray,
            prompt: str,
            negative_prompt: Optional[str],
            denoising_strength: float,
            seed: int,
            steps: int,
            sampler_name: SamplerName,
            cfg_scale: float,
            resize_mode: ResizeMode,
            width: int,
            height: int,
            pixels_to_expand: int,
            mask_blur: int,
            inpainting_fill: InpaintingFill,
            extend_left: bool,
            extend_right: bool,
            extend_up: bool,
            extend_down: bool,
    ) -> np.ndarray:
        width, height = nearest_valid_size(
            width, height
        )

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

        expected_output_width = int(ceil(expected_output_width/64)*64)
        expected_output_height = int(ceil(expected_output_height/64)*64)

        direction = ",".join(direction)
        request_data = {
            "init_images": [encode_base64_image(image)],
            "prompt": prompt,
            "negative_prompt": negative_prompt or "",
            "denoising_strength": denoising_strength,
            "seed": seed,
            "steps": steps,
            "sampler_name": sampler_name.value,
            "cfg_scale": cfg_scale,
            "width": width,
            "height": height,
            "resize_mode": resize_mode.value,
            "script_name": "Poor man's outpainting",
            "script_args": list({
                'pixels': pixels_to_expand,
                'mask_blur': mask_blur,
                'inpainting_fill': inpainting_fill.value,
                'direction': direction,
            }.values())
        }
        response = post(url=STABLE_DIFFUSION_IMG2IMG_URL, json_data=request_data)
        result = decode_base64_image(response["images"][0])
        h, w, _ = get_h_w_c(result)
        assert (w, h) == (
            expected_output_width,
            expected_output_height,
        ), f"Expected the returned image to be {expected_output_width}x{expected_output_height}px but found {w}x{h}px instead "
        return result