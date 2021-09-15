from ..NodeBase import NodeBase
from ..NodeFactory import NodeFactory
from ..properties.InputFactory import InputFactory
# from ..properties.inputs.FileInput import FileInput

import cv2
import numpy as np


@NodeFactory.register('opencv', 'imread')
class ImReadNode(NodeBase):
    """ OpenCV Imread node """
    def __init__(self, **kwargs):
        """ Constructor """
        inputs = []
        inputs.append(InputFactory.create_input('file', 'Image Path'))
        self.inputs = inputs
        self.outputs = [{'name': 'image', 'type': 'np.ndarray'}]
        # {
        #     'inputs': [{
        #         'label': 'path',
        #         'connectable': True,
        #         'type': 'file',
        #         'accepts': ['string']
        #     }],
        #     'outputs': [{
        #         'label': 'image',
        #         'type': 'np.ndarray'
        #     }]
        # }

    def run(self, path: str) -> np.ndarray:
        """ Reads an image from the specified path and return it as a numpy array """

        img = cv2.imread(path, cv2.IMREAD_UNCHANGED)

        return img
