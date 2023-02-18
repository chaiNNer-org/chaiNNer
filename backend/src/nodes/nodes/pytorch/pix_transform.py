from __future__ import annotations

import numpy as np
import torch

from ...impl.image_op import to_op
from ...impl.pytorch.pix_transform.pix_transform import DEFAULT_PARAMS, PixTransform
from ...impl.pytorch.utils import to_pytorch_execution_options
from ...impl.upscale.grayscale import grayscale_split
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, SliderInput
from ...properties.outputs import ImageOutput
from ...utils.exec_options import get_execution_options
from ...utils.utils import get_h_w_c
from . import category as PyTorchCategory


@NodeFactory.register("chainner:pytorch:pix_transform")
class PixTransformNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """TODO"""
        self.inputs = [
            ImageInput("Source"),
            ImageInput("Guide"),
            SliderInput(
                "Iterations",
                minimum=1,
                maximum=1000,
                default=32,
                scale="log",
                unit="k",
            ),
        ]
        self.outputs = [
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
        ]

        self.category = PyTorchCategory
        self.name = "Pix Transform"
        self.icon = "PyTorch"
        self.sub = "Processing"

    def run(self, source: np.ndarray, guide: np.ndarray, iterations: int) -> np.ndarray:
        s_h, s_w, _ = get_h_w_c(source)
        g_h, g_w, _ = get_h_w_c(guide)

        assert (
            g_h > s_h and g_w > s_w
        ), f"The guide image mus be larger than the source image."
        assert (
            g_w / s_w == g_w // s_w and g_w / s_w == g_h / s_h
        ), "The size of the guide image must be an integer multiple of the size of the source image (e.g. 2x, 3x, 4x, ...)."

        exec_options = to_pytorch_execution_options(get_execution_options())

        pix = to_op(PixTransform)(
            np.transpose(guide, (2, 0, 1)),
            device=torch.device(exec_options.full_device),
            params={**DEFAULT_PARAMS, "iteration": iterations * 1000},
        )

        return grayscale_split(source, pix)
