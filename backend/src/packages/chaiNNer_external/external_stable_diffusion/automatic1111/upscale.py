from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.groups import Condition, if_enum_group, if_group
from nodes.node_cache import cached
from nodes.properties.inputs import (
    BoolInput,
    EnumInput,
    ImageInput,
    NumberInput,
    SliderInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from ...features import web_ui
from ...util import decode_base64_image, encode_base64_image
from ...web_ui import (
    STABLE_DIFFUSION_EXTRA_SINGLE_IMAGE_PATH,
    UPSCALE_NAME_LABELS,
    UpscalerName,
    get_api,
)
from .. import auto1111_group


class UpscalerMode(Enum):
    SCALE_BY = "ScaleBy"
    SCALE_TO = "ScaleTo"


UPSCALER_MODE_LABELS = {
    UpscalerMode.SCALE_BY: "Scale by",
    UpscalerMode.SCALE_TO: "Scale to",
}


@auto1111_group.register(
    schema_id="chainner:external_stable_diffusion:upscaling",
    name="Upscale",
    description="Upscale an image using Automatic1111",
    icon="MdChangeCircle",
    inputs=[
        ImageInput(channels=3),
        EnumInput(
            UpscalerMode,
            default_value=UpscalerMode.SCALE_BY,
            option_labels=UPSCALER_MODE_LABELS,
        ).with_id(1),
        if_enum_group(1, UpscalerMode.SCALE_BY)(
            SliderInput(
                "Resize multiplier",
                minimum=1.0,
                default=4.0,
                maximum=8.0,
                slider_step=0.1,
                controls_step=0.1,
                precision=1,
            ).with_id(2),
        ),
        if_enum_group(1, UpscalerMode.SCALE_TO)(
            NumberInput("Width", controls_step=1, minimum=1, default=512).with_id(3),
            NumberInput("Height", controls_step=1, minimum=1, default=512).with_id(4),
            BoolInput("Crop to fit", default=True).with_id(5),
        ),
        EnumInput(
            UpscalerName,
            label="Upscaler 1",
            option_labels=UPSCALE_NAME_LABELS,
        ),
        BoolInput("Use second upscaler", default=False).with_id(7),
        if_group(Condition.bool(7, True))(
            EnumInput(
                UpscalerName,
                label="Upscaler 2",
                option_labels=UPSCALE_NAME_LABELS,
            ),
            SliderInput(
                "Upscaler 2 visibility",
                minimum=0.0,
                default=0.0,
                maximum=1.0,
                slider_step=0.001,
                controls_step=0.001,
                precision=3,
            ),
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                def nearest_valid(n: number) = max(1, floor(n));

                let in_w = Input0.width;
                let in_h = Input0.height;
                let ratio_w = width / in_w;
                let ratio_h = height / in_h;
                let larger_ratio = max(ratio_w, ratio_h);

                let mode = Input1;
                let factor = Input2;

                let crop = Input5;
                let width = Input3;
                let height = Input4;

                match mode {
                    UpscalerMode::ScaleTo => if crop {
                        Image { width: width, height: height }
                    } else {
                        Image {
                            width: nearest_valid(in_w*larger_ratio),
                            height: nearest_valid(in_h*larger_ratio)
                        }
                    },
                    UpscalerMode::ScaleBy => Image {
                        width: nearest_valid(in_w*factor),
                        height: nearest_valid(in_h*factor)
                    }
                }
            """,
            channels=3,
        )
    ],
    decorators=[cached],
    features=web_ui,
)
def upscale_node(
    image: np.ndarray,
    mode: UpscalerMode,
    upscaling_resize: float,
    width: int,
    height: int,
    crop: bool,
    upscaler_1: UpscalerName,
    use_second_upscaler: bool,
    upscaler_2: UpscalerName,
    upscaler_2_visibility: float,
) -> np.ndarray:
    if mode == UpscalerMode.SCALE_BY:
        resize_mode = 0
    else:
        resize_mode = 1

    if use_second_upscaler:
        u2 = upscaler_2.value
    else:
        u2 = "None"

    request_data = {
        "resize_mode": resize_mode,
        "show_extras_results": False,
        "gfpgan_visibility": 0.0,
        "codeformer_visibility": 0.0,
        "codeformer_weight": 0.0,
        "upscaling_resize": upscaling_resize,
        "upscaling_resize_w": width,
        "upscaling_resize_h": height,
        "upscaling_crop": crop,
        "upscaler_1": upscaler_1.value,
        "upscaler_2": u2,
        "extras_upscaler_2_visibility": upscaler_2_visibility,
        "upscale_first": False,
        "image": encode_base64_image(image),
    }
    response = get_api().post(
        path=STABLE_DIFFUSION_EXTRA_SINGLE_IMAGE_PATH, json_data=request_data
    )
    result = decode_base64_image(response["image"])

    ih, iw, _ = get_h_w_c(image)
    rh, rw, _ = get_h_w_c(result)
    ratio_w = width / iw
    ratio_h = height / ih
    if ratio_w > ratio_h:
        larger_ratio = ratio_w
    else:
        larger_ratio = ratio_h

    if mode == UpscalerMode.SCALE_TO:
        if crop:
            assert (rw, rh) == (
                width,
                height,
            ), f"Expected the returned image to be {width}x{height}px but found {rw}x{rh}px instead "
        else:
            assert (rw, rh) == (
                int(iw * larger_ratio),
                int(ih * larger_ratio),
            ), f"Expected the returned image to be {width}x{height}px but found {rw}x{rh}px instead "
    else:
        assert (rw, rh) == (
            int(iw * upscaling_resize),
            int(ih * upscaling_resize),
        ), f"Expected the returned image to be {width}x{height}px but found {rw}x{rh}px instead "

    return result
