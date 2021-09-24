import logging

import cv2
import numpy as np

from .NodeBase import NodeBase
from .NodeFactory import NodeFactory
from .properties.inputs.FileInputs import ImageFileInput
from .properties.inputs.NumPyInputs import ImageInput
from .properties.outputs.FileOutputs import ImageFileOutput
from .properties.outputs.NumPyOutputs import ImageOutput

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


@NodeFactory.register("OpenCV", "Image::Write")
class ImWriteNode(NodeBase):
    """ OpenCV Imwrite node """

    def __init__(self):
        """ Constructor """
        self.inputs = [ImageInput()]
        self.outputs = [ImageFileOutput()]

    def run(self, img: np.ndarray, path: str) -> bool:
        """ Write an image to the specified path and return write status """

        logger.info(f"Writing image to path: {path}")
        status = cv2.imwrite(path, img)

        return status
