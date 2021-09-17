from ..NodeBase import NodeBase
from ..NodeFactory import NodeFactory
from ..properties.inputs.FileInputs import ImageFileInput
from ..properties.outputs.NumPyOutputs import ImageOutput

import cv2
import numpy as np


@NodeFactory.register('OpenCV', 'Image::Read')
class ImReadNode(NodeBase):
    """ OpenCV Imread node """
    def __init__(self, **kwargs):
        """ Constructor """
        self.inputs = [ImageFileInput()]
        self.outputs = [ImageOutput()]

    def run(self, path: str) -> np.ndarray:
        """ Reads an image from the specified path and return it as a numpy array """

        img = cv2.imread(path, cv2.IMREAD_UNCHANGED)

        return img
