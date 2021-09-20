from typing import List

import cv2

import numpy as np

from ..NodeBase import NodeBase
from ..NodeFactory import NodeFactory
from ..properties.inputs.NumPyInputs import SplitImageChannelImage
from ..properties.outputs.NumPyOutputs import ImageOutput


@NodeFactory.register("NumPy", "Channel::Merge")
class ImReadNode(NodeBase):
    """ NumPy Merger node """

    def __init__(self):
        """ Constructor """
        self.inputs = [SplitImageChannelImage()]
        self.outputs = [ImageOutput()]

    def run(self, imgs: List[np.ndarray]) -> np.ndarray:
        """ Combine separate channels into a multi-chanel image  """

        # TODO: compare this to combining with numpy
        img = cv2.merge(imgs)

        return img
