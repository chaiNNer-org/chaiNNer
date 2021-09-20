import logging

import cv2
import numpy as np

from ..NodeBase import NodeBase
from ..NodeFactory import NodeFactory
from ..properties.inputs.FileInputs import ImageFileInput
from ..properties.outputs.NumPyOutputs import ImageOutput

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@NodeFactory.register("OpenCV", "Image::Read")
class ImReadNode(NodeBase):
    """ OpenCV Imread node """

    def __init__(self):
        """ Constructor """
        self.inputs = [ImageFileInput()]
        self.outputs = [ImageOutput()]

    def run(self, path: str) -> np.ndarray:
        """ Reads an image from the specified path and return it as a numpy array """

        logger.info(f"Reading image from path: {path}")
        img = cv2.imread(path, cv2.IMREAD_UNCHANGED)

        return img
