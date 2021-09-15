from ..NodeBase import NodeBase
from ..NodeFactory import NodeFactory
from ..properties.InputFactory import InputFactory

import cv2
import numpy as np


@NodeFactory.register('OpenCV', 'Write Image')
class ImWriteNode(NodeBase):
    """ OpenCV Imwrite node """
    def __init__(self, **kwargs):
        """ Constructor """
        inputs = []
        inputs.append(InputFactory.create_input('image', 'Image'))
        self.inputs = inputs
        self.outputs = [{'name': 'status', 'type': 'boolean'}]

    def run(self, img: np.ndarray, path: str) -> bool:
        """ Write an image to the specified path and return write status """

        status = cv2.imwrite(path, img)

        return status