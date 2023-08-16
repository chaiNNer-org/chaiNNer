from __future__ import annotations

import numpy as np

from nodes.impl.pytorch.pix_transform.auto_split import pix_transform_auto_split
from nodes.impl.pytorch.pix_transform.pix_transform import Params
from nodes.impl.pytorch.utils import get_pytorch_device
from nodes.impl.upscale.grayscale import SplitMode
from nodes.properties.inputs import EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from ... import get_pytorch_settings
from .. import processing_group


@processing_group.register(
    schema_id="chainner:pytorch:guided_upscale",
    name="Guided Upscale",
    description=(
        "Upscales a source image using a guide."
        " This is most useful for very small source images."
        "\n\nUnder the hood, PixTransform is used which trains a NN to convert the guide image into the source image."
        " Note that this operation is very expensive, because it needs to train a NN."
        " Try a small number of iterations before going up to around 30k."
    ),
    icon="PyTorch",
    inputs=[
        ImageInput("Source"),
        ImageInput("Guide"),
        SliderInput(
            "Iterations",
            minimum=0.1,
            maximum=100,
            default=1,
            precision=1,
            scale="log",
            unit="k",
        ),
        EnumInput(
            SplitMode,
            "Channel split mode",
            SplitMode.LAB,
            option_labels={SplitMode.RGB: "RGB", SplitMode.LAB: "L*a*b"},
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let source = Input0;
                let guide = Input1;

                let valid = bool::and(
                    // guide image must be larger than source image
                    guide.width > source.width,
                    // guide image's size must be `k * source.size` for `k>1`
                    guide.width / source.width == int,
                    guide.width / source.width == guide.height / source.height
                );

                Image {
                    width: guide.width,
                    height: guide.height,
                    channels: source.channels,
                } & if valid { any } else { never }
                """
        ).with_never_reason(
            "The guide image must be larger than the source image, and the size of the guide image must be an integer multiple of the size of the source image (e.g. 2x, 3x, 4x, ...)."
        ),
    ],
)
def guided_upscale_node(
    source: np.ndarray,
    guide: np.ndarray,
    iterations: float,
    split_mode: SplitMode,
) -> np.ndarray:
    exec_options = get_pytorch_settings()
    pytorch_device = get_pytorch_device(
        exec_options.get("cpu_mode", False), exec_options.get("gpu", 0)
    )

    return pix_transform_auto_split(
        source=source,
        guide=guide,
        device=pytorch_device,
        params=Params(iteration=int(iterations * 1000)),
        split_mode=split_mode,
    )
