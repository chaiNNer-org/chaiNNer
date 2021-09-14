from ..NodeBase import NodeBase
from ..NodeFactory import NodeFactory

import cv2
import numpy as np


@NodeFactory.register('opencv', 'imwrite')
class ImWriteNode(NodeBase):
    """ OpenCV Imwrite node """
    def __init__(self):
        """ Constructor """
        # TODO: Figure out how I'm gonna do this
        self.path = 'path'
        self.ins = 'ins'

        self.properties = [{'name': 'path', 'type': 'string'}]
        self.inputs = [{'name': 'image', 'type': 'np.ndarray'}]
        self.outputs = [{'name': 'status', 'type': 'boolean'}]

    def execute(self):
        img = self.ins[0].execute()
        return self.run(img, self.path)

    def run(self, img: np.ndarray, path: str) -> bool:
        """ Write an image to the specified path and return write status """

        status = cv2.imwrite(path, img)

        return status