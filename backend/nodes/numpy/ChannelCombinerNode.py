from ..NodeBase import NodeBase
from ..NodeFactory import NodeFactory
from ..properties.inputs.NumPyInputs import SplitImageChannelImage
from ..properties.outputs.NumPyOutputs import ImageOutput

import cv2
import numpy as np


@NodeFactory.register('NumPy', 'Channel::Merge')
class ImReadNode(NodeBase):
    """ NumPy Merger node """
    def __init__(self, **kwargs):
        """ Constructor """
        self.inputs = [SplitImageChannelImage()]
        self.outputs = [ImageOutput()]

    def run(self, img: np.ndarray) -> np.ndarray:
        """ Split a multi-chanel image into separate channels """

        # TODO: compare this to splitting with numpy
        imgs = cv2.split(img)

        return imgs
