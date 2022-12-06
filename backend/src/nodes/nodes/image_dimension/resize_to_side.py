from __future__ import annotations

import numpy as np
from sanic.log import logger

from . import category as ImageDimensionCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import (
    ImageInput,
    NumberInput,
    InterpolationInput,
    ResizeToSideInput,
    ResizeCondition,
)
from ...properties.outputs import ImageOutput
from ...utils.pil_utils import resize
from ...utils.utils import get_h_w_c, resize_to_side_conditional


@NodeFactory.register("chainner:image:resize_to_side")
class ImResizeToSide(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Resize an image to a given side length while keeping aspect ratio. "
            "Auto uses box for downsampling and lanczos for upsampling."
        )
        self.inputs = [
            ImageInput(),
            NumberInput(
                "Size Target",
                default=2160,
                minimum=1,
                unit="px",
            ),
            ResizeToSideInput(),
            InterpolationInput(),
            ResizeCondition(),
        ]
        self.category = ImageDimensionCategory
        self.name = "Resize To Side"
        self.outputs = [
            ImageOutput(
                image_type="""
                struct Size { width: uint, height: uint }

                let w = Input0.width;
                let h = Input0.height;
                let target = Input1;
                let side = Input2;
                let condition = Input4;

                def compareCondition(b: uint): bool {
                    match condition {
                        ResizeCondition::Both => false,
                        ResizeCondition::Downscale => target > b,
                        ResizeCondition::Upscale => target < b
                    }
                }

                let same = Size { width: w, height: h };

                let outSize = match side {
                    SideSelection::Width => if compareCondition(w) { same } else {
                        Size {
                            width: target,
                            height: max(int & round((target / w) * h), 1)
                        }
                    },
                    SideSelection::Height => if compareCondition(h) { same } else {
                        Size {
                            width: max(int & round((target / h) * w), 1),
                            height: target
                        }
                    },
                    SideSelection::Shorter => if compareCondition(min(h, w)) { same } else {
                        Size {
                            width: max(int & round((target / min(h, w)) * w), 1),
                            height: max(int & round((target / min(h, w)) * h), 1)
                        }
                    },
                    SideSelection::Longer => if compareCondition(max(h, w)) { same } else {
                        Size {
                            width: max(int & round((target / max(h, w)) * w), 1),
                            height: max(int & round((target / max(h, w)) * h), 1)
                        }
                    },
                };

                Image {
                    width: outSize.width,
                    height: outSize.height,
                    channels: Input0.channels
                }
                """
            )
        ]
        self.icon = "MdOutlinePhotoSizeSelectLarge"
        self.sub = "Resize"

    def run(
        self,
        img: np.ndarray,
        target: int,
        side: str,
        interpolation: int,
        condition: str,
    ) -> np.ndarray:
        """Takes an image and resizes it"""

        logger.debug(f"Resizing image to {side} via {interpolation}")

        h, w, _ = get_h_w_c(img)
        out_dims = resize_to_side_conditional(w, h, target, side, condition)

        return resize(img, out_dims, interpolation)
