"""
Nodes that provide functionality for opencv image manipulation
"""

from os import path

import cv2
import numpy as np
from sanic.log import logger

from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs.file_inputs import (
    DirectoryInput,
    ImageExtensionDropdown,
    ImageFileInput,
)
from .properties.inputs.generic_inputs import (
    DropDownInput,
    IntegerInput,
    NumberInput,
    TextInput,
)
from .properties.inputs.numpy_inputs import ImageInput
from .properties.inputs.opencv_inputs import (
    ColorModeInput,
    InterpolationInput,
    BorderInput,
)
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

    def run(self, path: str) -> np.ndarray:
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

    def run(
        self, img: np.ndarray, directory: str, filename: str, extension: str
    ) -> bool:
        """Write an image to the specified path and return write status"""
        fullFile = f"{filename}.{extension}"
        fullPath = path.join(directory, fullFile)
        logger.info(f"Writing image to path: {fullPath}")
        status = cv2.imwrite(fullPath, img)

        return status


@NodeFactory.register("OpenCV", "Image::Show")
class ImShowNode(NodeBase):
    """OpenCV Imshow node"""

    def __init__(self):
        """Constructor"""
        self.description = "Show image preview in a new window"
        self.inputs = [ImageInput()]
        self.outputs = []

    def checkerboard(self, h, w):
        square_size = 8
        new_h = (h // square_size) + 1
        new_w = (w // square_size) + 1
        # Black and white checkerboard
        # from https://stackoverflow.com/questions/2169478/how-to-make-a-checkerboard-in-numpy
        checkerboard = (np.indices((new_h, new_w)).sum(axis=0) % 2).astype("uint8")
        # Modify to a mixed grayish color
        checkerboard = ((checkerboard * 127) + 128) // 2
        # Resize to full size
        checkerboard = cv2.resize(
            checkerboard,
            (new_w * square_size, new_h * square_size),
            interpolation=cv2.INTER_NEAREST,
        )
        # Crop to fit original resolution
        checkerboard = checkerboard[:h, :w]
        return checkerboard.astype("float32") / 255

    def run(self, img: np.ndarray) -> bool:
        """Show image"""
        try:
            dtype_max = np.iinfo(img.dtype).max
            show_img = img.astype("float32") / dtype_max
            logger.info(dtype_max)
            if img.ndim > 2 and img.shape[2] == 4:
                h, w, _ = img.shape
                checkerboard = self.checkerboard(h, w)
                checkerboard = cv2.cvtColor(checkerboard, cv2.COLOR_GRAY2BGR)
                alpha = cv2.cvtColor(show_img[:, :, 3], cv2.COLOR_GRAY2BGR)

                foreground = cv2.multiply(alpha, show_img[:, :, :3])
                background = cv2.multiply(1.0 - alpha, checkerboard)
                show_img = cv2.add(foreground, background)

            cv2.imshow("Image Preview", show_img)
            cv2.waitKey(0)
        except Exception as e:
            logger.fatal(e)
            logger.fatal("Imshow had a critical error")


@NodeFactory.register("OpenCV", "Resize::Factor")
class ImResizeByFactorNode(NodeBase):
    """OpenCV resize node"""

    def __init__(self):
        """Constructor"""
        self.description = "Resize a numpy array image by a scale factor"
        self.inputs = [ImageInput(), NumberInput("Scale Factor"), InterpolationInput()]
        self.outputs = [ImageOutput()]

    def run(self, img: np.ndarray, scale: float, interpolation: int) -> np.ndarray:
        """Takes an image and resizes it"""

        logger.info(f"Resizing image by {scale} via {interpolation}")
        result = cv2.resize(
            img,
            None,
            fx=float(scale),
            fy=float(scale),
            interpolation=int(interpolation),
        )

        return result


@NodeFactory.register("OpenCV", "Resize::Resolution")
class ImResizeToResolutionNode(NodeBase):
    """OpenCV resize node"""

    def __init__(self):
        """Constructor"""
        self.description = "Resize a numpy array image to an exact resolution"
        self.inputs = [
            ImageInput(),
            IntegerInput("Width"),
            IntegerInput("Height"),
            InterpolationInput(),
        ]
        self.outputs = [ImageOutput()]

    def run(
        self, img: np.ndarray, width: int, height: int, interpolation: int
    ) -> np.ndarray:
        """Takes an image and resizes it"""

        logger.info(f"Resizing image to {width}x{height} via {interpolation}")
        result = cv2.resize(
            img, (int(width), int(height)), interpolation=int(interpolation)
        )

        return result


@NodeFactory.register("OpenCV", "Color::Convert")
class ColorConvertNode(NodeBase):
    """OpenCV color conversion node"""

    def __init__(self):
        """Constructor"""
        self.description = "Converts the color of an image"
        self.inputs = [
            ImageInput(),
            ColorModeInput(),
        ]
        self.outputs = [ImageOutput()]

    def run(self, img: np.ndarray, color_mode: int) -> np.ndarray:
        """Takes an image and changes the color mode it"""

        result = cv2.cvtColor(img, int(color_mode))

        return result


@NodeFactory.register("OpenCV", "Border::Make")
class BorderMakeNode(NodeBase):
    """OpenCV CopyMakeBorder node"""

    def __init__(self):
        """Constructor"""
        self.description = "Creates a border around the image"
        self.inputs = [
            ImageInput(),
            BorderInput(),
            IntegerInput("Amount"),
        ]
        self.outputs = [ImageOutput()]

    def run(self, img: np.ndarray, border_type: int, amount: int) -> np.ndarray:
        """Takes an image and applies a border to it"""

        result = cv2.copyMakeBorder(
            img,
            int(amount),
            int(amount),
            int(amount),
            int(amount),
            int(border_type),
            None,
            value=0,
        )

        return result
