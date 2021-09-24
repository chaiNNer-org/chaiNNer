from typing import List

import cv2
import numpy as np

from .NodeBase import NodeBase
from .NodeFactory import NodeFactory
from .properties.inputs.NumPyInputs import ImageInput, SplitImageChannelImage
from .properties.outputs.NumPyOutputs import ImageOutput, SplitImageChannelOutput


@NodeFactory.register("NumPy", "Channel::Merge")
class ChannelMergeNode(NodeBase):
    """ NumPy Merger node """

    def __init__(self):
        """ Constructor """
        self.inputs = [SplitImageChannelImage()]
        self.outputs = [ImageOutput()]

    def run(self, imgs: List[np.ndarray]) -> np.ndarray:
        """ Combine separate channels into a multi-chanel image  """

        img = cv2.merge(imgs)

        return img


@NodeFactory.register("NumPy", "Channel::Split")
class ChannelSplitNode(NodeBase):
    """ NumPy Splitter node """

    def __init__(self):
        """ Constructor """
        self.inputs = [ImageInput()]
        self.outputs = [SplitImageChannelOutput()]

    def run(self, img: np.ndarray) -> np.ndarray:
        """ Split a multi-chanel image into separate channels """

        imgs = cv2.split(img)

        return imgs
