from __future__ import annotations

import numpy as np
import cv2

from ....categories import ImageUtilityCategory
from ....node_base import NodeBase
from ....node_factory import NodeFactory
from ....properties.inputs import (
    ImageInput,
    ColorModeInput,
)
from ....properties.outputs import ImageOutput
from ....properties import expression
from ....utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:change_colorspace")
class ColorConvertNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Convert the colorspace of an image to a different one. "
            "Also can convert to different channel-spaces."
        )
        self.inputs = [
            ImageInput(image_type=expression.Image(channels="Input1.inputChannels")),
            ColorModeInput(),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    size_as="Input0",
                    channels="Input1.outputChannels",
                )
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Change Colorspace"
        self.icon = "MdColorLens"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray, color_mode: int) -> np.ndarray:
        """Takes an image and changes the color mode it"""

        def reverse3(image: np.ndarray) -> np.ndarray:
            c = get_h_w_c(image)[2]
            assert c == 3, "Expected a 3-channel image"
            return np.stack([image[:, :, 2], image[:, :, 1], image[:, :, 0]], axis=2)

        # preprocessing
        if color_mode in (cv2.COLOR_HSV2BGR, cv2.COLOR_YUV2BGR):
            img = reverse3(img)

        if color_mode == cv2.COLOR_HSV2BGR:
            img[:, :, 0] *= 360

        # color conversion
        result = cv2.cvtColor(img, color_mode)

        # postprocessing
        if color_mode == cv2.COLOR_BGR2HSV:
            result[:, :, 0] /= 360  # type: ignore

        if color_mode in (cv2.COLOR_BGR2HSV, cv2.COLOR_BGR2YUV):
            result = reverse3(result)

        return result
