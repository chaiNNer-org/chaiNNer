from __future__ import annotations
from typing import Union

import numpy as np
import cv2

from . import category as ImageChannelCategory
from ...api.node_base import NodeBase
from ...api.node_factory import NodeFactory
from ...api.inputs import ImageInput
from ...api.outputs import ImageOutput
from ...api import expression
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:merge_channels")
class ChannelMergeRGBANode(NodeBase):
    """NumPy Merger node"""

    def __init__(self):
        super().__init__()
        self.description = (
            "Merge image channels together into a ≤4 channel image. "
            "Typically used for combining an image with an alpha layer."
        )
        self.inputs = [
            ImageInput("Channel(s) A"),
            ImageInput("Channel(s) B").make_optional(),
            ImageInput("Channel(s) C").make_optional(),
            ImageInput("Channel(s) D").make_optional(),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    size_as="Input0",
                    channels="""
                    match (
                        Input0.channels
                        + match Input1 { Image as i => i.channels, _ => 0 }
                        + match Input2 { Image as i => i.channels, _ => 0 }
                        + match Input3 { Image as i => i.channels, _ => 0 }
                    ) {
                        1 => 1,
                        2 | 3 => 3,
                        int(4..) => 4
                    }
                    """,
                )
            )
        ]
        self.category = ImageChannelCategory
        self.name = "Merge Channels"
        self.icon = "MdCallMerge"
        self.sub = "All"
        self.deprecated = True

    def run(
        self,
        im1: np.ndarray,
        im2: Union[np.ndarray, None],
        im3: Union[np.ndarray, None],
        im4: Union[np.ndarray, None],
    ) -> np.ndarray:
        """Combine separate channels into a multi-chanel image"""

        start_shape = im1.shape[:2]

        for im in im2, im3, im4:
            if im is not None:
                assert (
                    im.shape[:2] == start_shape
                ), "All images to be merged must be the same resolution"

        imgs = []
        for img in im1, im2, im3, im4:
            if img is not None:
                imgs.append(img)

        for idx, img in enumerate(imgs):
            if img.ndim == 2:
                imgs[idx] = np.expand_dims(img, axis=2)

        img = np.concatenate(imgs, axis=2)

        # ensure output is safe number of channels
        _, _, c = get_h_w_c(img)
        if c == 2:
            b, g = cv2.split(img)
            img = cv2.merge((b, g, g))
        elif c > 4:
            img = img[:, :, :4]

        return img
