"""
Nodes that provide functionality for numpy array manipulation
"""

from typing import List

import cv2
import numpy as np
from sanic.log import logger

from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs.generic_inputs import SliderInput
from .properties.inputs.numpy_inputs import ImageInput
from .properties.outputs.numpy_outputs import ImageOutput


@NodeFactory.register("NumPy", "Img::Channel::Split")
class ChannelSplitRGBANode(NodeBase):
    """NumPy 4 -> 3/1 Splitter node"""

    def __init__(self):
        """Constructor"""
        self.description = "Split 4 numpy channels into a 3 channel image and a single channel image. Typically used for splitting off an alpha (transparency) layer."
        self.inputs = [ImageInput(), SliderInput("Split Position", 1, 3, 3)]
        self.outputs = [ImageOutput("Channel(s) A"), ImageOutput("Channel(s) B")]

    def run(self, img: np.ndarray, position: int) -> np.ndarray:
        """Split a multi-chanel image into separate channels"""
        if img.ndim > 2:
            h, w, c = img.shape
            position = min(c, position)
        if img.ndim == 2:
            position = min(1, position)

        out1 = img[:, :, :position]
        out2 = img[:, :, position:]

        return out1, out2


@NodeFactory.register("NumPy", "Img::Channel::Merge")
class ChannelMergeRGBANode(NodeBase):
    """NumPy Merger node"""

    def __init__(self):
        """Constructor"""
        self.description = "Merge 3/1 numpy channels together into a 4 channel image. Typically used for combining an image with an alpha layer."
        self.inputs = [ImageInput("Channel(s) A"), ImageInput("Channel(s) B")]
        self.outputs = [ImageOutput()]

    def run(self, im1: np.ndarray, im2: np.ndarray) -> np.ndarray:
        """Combine separate channels into a multi-chanel image"""

        logger.info(im1.shape)
        logger.info(im2.shape)

        img = np.concatenate((im1, im2), axis=2)

        # ensure output is safe number of channels
        if img.ndim > 2:
            h, w, c = img.shape
            if c == 2:
                b, g = cv2.split(img)
                img = cv2.merge((b, g, g))
            if c > 4:
                img = img[:, :, :4]

        return img
