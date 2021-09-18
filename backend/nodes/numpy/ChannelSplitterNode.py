from ..NodeBase import NodeBase
from ..NodeFactory import NodeFactory
from ..properties.inputs.NumPyInputs import ImageInput
from ..properties.outputs.NumPyOutputs import SplitImageChannelOutput

import cv2
import numpy as np


@NodeFactory.register('NumPy', 'Channel::Split')
class ImReadNode(NodeBase):
    """ NumPy Splitter node """
    def __init__(self, **kwargs):
        """ Constructor """
        self.inputs = [ImageInput()]
        self.outputs = [SplitImageChannelOutput()]

    def run(self, img: np.ndarray) -> np.ndarray:
        """ Split a multi-chanel image into separate channels """

        # TODO: compare this to splitting with numpy
        imgs = cv2.split(img)

        return imgs
