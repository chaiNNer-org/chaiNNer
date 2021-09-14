from numpy.core.records import array
from ..NodeBase import NodeBase
from ..NodeFactory import NodeFactory

import cv2
import numpy as np


@NodeFactory.register('opencv', 'imread')
class ImReadNode(NodeBase):
    """ OpenCV Imread node """
    def __init__(self):
        """ Constructor """
        # TODO: Figure out how I'm gonna do this
        self.path = 'path'

        # TODO: Rethink how this should be done
        # It probably should be a property factory or something
        self.properties = [{'name': 'path', 'type': 'string'}]

        # We also need some way of defining the in and out typing for node validation

        self.inputs = None
        self.outputs = [{'name': 'image', 'type': 'np.ndarray'}]

    def execute(self):
        return self.run(self.path)

    def run(self, path: str) -> np.ndarray:
        """ Reads an image from the specified path and return it as a numpy array """

        img = cv2.imread(path, cv2.IMREAD_UNCHANGED)

        return img
