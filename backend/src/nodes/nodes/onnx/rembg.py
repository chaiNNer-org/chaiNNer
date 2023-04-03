from __future__ import annotations

from typing import Tuple

import numpy as np

from ...groups import Condition, if_group
from ...impl.onnx.model import OnnxRemBg
from ...impl.onnx.session import get_onnx_session
from ...impl.rembg.bg import remove_bg
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import ImageInput, OnnxRemBgModelInput
from ...properties.inputs.generic_inputs import BoolInput
from ...properties.inputs.numeric_inputs import NumberInput, SliderInput
from ...properties.outputs import ImageOutput
from ...utils.exec_options import get_execution_options
from . import category as ONNXCategory


@NodeFactory.register("chainner:onnx:rembg")
class RemBgNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Removes background from image.
        Currently supports u2net models from the rembg project (links found in readme)."""
        self.inputs = [
            ImageInput(),
            OnnxRemBgModelInput(),
            BoolInput("Post-process Mask", default=False),
            BoolInput("Alpha Matting", default=False),
            if_group(Condition.bool(3, True))(
                SliderInput(
                    "Foreground Threshold", minimum=1, maximum=255, default=240
                ),
                SliderInput("Background Threshold", maximum=254, default=10),
                NumberInput("Erode Size", minimum=1, default=10),
            ),
        ]
        self.outputs = [
            ImageOutput(
                "Image",
                image_type="""removeBackground(Input1, Input0)""",
            ),
            ImageOutput(
                "Mask", image_type=expression.Image(size_as="Input0"), channels=1
            ),
        ]

        self.category = ONNXCategory
        self.name = "Remove Background"
        self.icon = "ONNX"
        self.sub = "Processing"

    def run(
        self,
        img: np.ndarray,
        model: OnnxRemBg,
        post_process_mask: int,
        alpha_matting: int,
        foreground_threshold: int,
        background_threshold: int,
        kernel_size: int,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Removes background from image"""

        session = get_onnx_session(model, get_execution_options())

        return remove_bg(
            img,
            session,
            bool(alpha_matting),
            foreground_threshold,
            background_threshold,
            alpha_matting_erode_size=kernel_size,
            post_process_mask=bool(post_process_mask),
        )
