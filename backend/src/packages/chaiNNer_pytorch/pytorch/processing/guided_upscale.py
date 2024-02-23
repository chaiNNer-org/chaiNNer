from __future__ import annotations

import numpy as np

from api import NodeContext
from nodes.impl.pytorch.pix_transform.auto_split import pix_transform_auto_split
from nodes.impl.pytorch.pix_transform.pix_transform import Params
from nodes.impl.upscale.grayscale import SplitMode
from nodes.properties.inputs import EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from ...settings import get_settings
from .. import processing_group


@processing_group.register(
    schema_id="chainner:pytorch:guided_upscale",
    name="引导放大",
    description=(
        "使用引导放大源图像。"
        " 这对于非常小的源图像最有用。"
        "\n\n在底层使用 PixTransform，该工具训练一个神经网络将引导图像转换为源图像。"
        " 请注意，此操作非常昂贵，因为它需要训练一个神经网络。"
        " 在尝试 30000 次左右之前，请尝试少量迭代。"
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

                let kScale = bool::and(
                    // guide image's size must be `k * source.size` for `k>1`
                    guide.width / source.width == int,
                    guide.width / source.width == guide.height / source.height
                );

                if guide.width <= source.width {
                    error("The guide image must be larger than the source image.")
                } else if bool::not(kScale) {
                    error("The size of the guide image must be an integer multiple of the size of the source image (e.g. 2x, 3x, 4x, ...).")
                } else {
                    Image {
                        width: guide.width,
                        height: guide.height,
                        channels: source.channels,
                    }
                }
                """
        ),
    ],
    node_context=True,
)
def guided_upscale_node(
    context: NodeContext,
    source: np.ndarray,
    guide: np.ndarray,
    iterations: float,
    split_mode: SplitMode,
) -> np.ndarray:
    return pix_transform_auto_split(
        source=source,
        guide=guide,
        device=get_settings(context).device,
        params=Params(iteration=int(iterations * 1000)),
        split_mode=split_mode,
    )
