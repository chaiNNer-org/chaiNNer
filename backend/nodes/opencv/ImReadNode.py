from ..NodeBase import NodeBase
from ..NodeFactory import NodeFactory

import cv2
import numpy as np


@NodeFactory.register('opencv', 'imread')
class ImReadNode(NodeBase):

    # TODO: Rethink how this should be done
    # It probably should be a property factory or something
    properties = [{'path': 'string'}]

    # We also need some way of defining the in and out typing for node validation

    input_types = [str]
    output_types = [np.ndarray]

    def run(self, path: str) -> np.ndarray:
        """ Reads an image from the specified path and return it as a numpy array """

        img = cv2.imread(path, cv2.IMREAD_UNCHANGED)

        return img