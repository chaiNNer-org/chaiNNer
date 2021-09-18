from ..NodeBase import NodeBase
from ..NodeFactory import NodeFactory
from ..properties.inputs.FileInputs import PthFileInput
from ..properties.inputs.NumPyInputs import ImageInput
from ..properties.outputs.NumPyOutputs import ImageOutput

import torch
import numpy as np


@NodeFactory.register('PyTorch', 'ESRGAN')
class ImReadNode(NodeBase):
    """ ESRGAN node """
    def __init__(self, **kwargs):
        """ Constructor """
        self.inputs = [PthFileInput(), ImageInput()]
        self.outputs = [ImageOutput('Upscaled Image')]

    def run(self, path: str, img: np.ndarray) -> np.ndarray:
        """ Reads an image from the specified path and return it as a numpy array """

        # TODO: ESRGAN Logic

        return img
