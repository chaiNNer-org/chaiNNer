"""
Nodes that provide functionality for opencv image manipulation
"""

from cv2 import IMREAD_UNCHANGED, imread, imwrite
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
        img = imread(path, IMREAD_UNCHANGED)

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

    def run(
        self, img: ndarray, path: str = "C:/Users/Joey/Desktop/this_is_a_test.png"
    ) -> bool:
        """Write an image to the specified path and return write status"""

        logger.info(f"Writing image to path: {path}")
        status = imwrite(path, img)

        return status
