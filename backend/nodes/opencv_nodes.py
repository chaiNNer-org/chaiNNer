"""
Nodes that provide functionality for opencv image manipulation
"""

from os import path

import cv2
from numpy import ndarray
from sanic.log import logger

from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs.file_inputs import (
    DirectoryInput,
    ImageExtensionDropdown,
    ImageFileInput,
)
from .properties.inputs.generic_inputs import DropDownInput, TextInput
from .properties.inputs.numpy_inputs import ImageInput
from .properties.outputs.file_outputs import ImageFileOutput
from .properties.outputs.numpy_outputs import ImageOutput


@NodeFactory.register("OpenCV", "Image::Read")
class ImReadNode(NodeBase):
    """OpenCV Imread node"""

    def __init__(self):
        """Constructor"""
        self.description = "Read image from file into BGR numpy array"
        self.inputs = [ImageFileInput()]
        self.outputs = [ImageOutput()]

    def run(self, path: str) -> ndarray:
        """Reads an image from the specified path and return it as a numpy array"""

        logger.info(f"Reading image from path: {path}")
        img = cv2.imread(path, cv2.IMREAD_UNCHANGED)

        return img


@NodeFactory.register("OpenCV", "Image::Write")
class ImWriteNode(NodeBase):
    """OpenCV Imwrite node"""

    def __init__(self):
        """Constructor"""
        self.description = "Write image from BGR numpy array to file"
        self.inputs = [
            ImageInput(),
            DirectoryInput(),
            TextInput("Image Name"),
            ImageExtensionDropdown(),
        ]
        self.outputs = []

    def run(self, img: ndarray, directory: str, filename: str, extension: str) -> bool:
        """Write an image to the specified path and return write status"""
        fullFile = f"{filename}.{extension}"
        fullPath = path.join(directory, fullFile)
        logger.info(f"Writing image to path: {fullPath}")
        status = cv2.imwrite(fullPath, img)

        return status


@NodeFactory.register("OpenCV", "Image::Show")
class ImWriteNode(NodeBase):
    """OpenCV Imshow node"""

    def __init__(self):
        """Constructor"""
        self.description = "Show image preview in a new window"
        self.inputs = [ImageInput()]
        self.outputs = []

    def run(self, img: ndarray) -> bool:
        """Show image"""
        cv2.imshow("Image Preview", img)
        cv2.waitKey(0)
