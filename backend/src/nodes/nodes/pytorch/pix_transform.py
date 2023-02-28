from __future__ import annotations

import numpy as np
import torch

from ...impl.pytorch.pix_transform.auto_split import pix_transform_auto_split
from ...impl.pytorch.pix_transform.pix_transform import Params
from ...impl.pytorch.utils import to_pytorch_execution_options
from ...impl.upscale.grayscale import SplitMode
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import EnumInput, ImageInput, SliderInput
from ...properties.outputs import ImageOutput
from ...utils.exec_options import get_execution_options
from . import category as PyTorchCategory


@NodeFactory.register("chainner:pytorch:pix_transform")
class PixTransformNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Trains a NN to convert the guide image into the source image."
            " This is most useful for very small source images."
            " Note that this operation is very expensive, because it needs to train a NN."
            " Try a small number of iterations before going back to around 30k."
        )
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
            EnumInput(
                SplitMode,
                "Channel split mode",
                SplitMode.LAB,
                option_labels={SplitMode.RGB: "RGB", SplitMode.LAB: "L*a*b"},
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

    def run(
        self,
        source: np.ndarray,
        guide: np.ndarray,
        iterations: int,
        split_mode: SplitMode,
    ) -> np.ndarray:
        exec_options = to_pytorch_execution_options(get_execution_options())

        return pix_transform_auto_split(
            source=source,
            guide=guide,
            device=torch.device(exec_options.full_device),
            params=Params(iteration=iterations * 1000),
        )
