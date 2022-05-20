from __future__ import annotations

import math

import numpy as np
from sanic.log import logger

from .categories import IMAGE_DIMENSION
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.fill_alpha import *
from .utils.pil_utils import *


@NodeFactory.register("chainner:image:resize_factor")
class ImResizeByFactorNode(NodeBase):
    """OpenCV resize node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = (
            "Resize an image by a percent scale factor. "
            "Auto uses box for downsampling and lanczos for upsampling."
        )
        self.inputs = [
            ImageInput(),
            NumberInput(
                "Scale Factor",
                precision=4,
                step=0.0001,
                controlsStep=25.0,
                minimum=0,
                default=100.0,
                units="%",
            ),
            InterpolationInput(),
        ]
        self.category = IMAGE_DIMENSION
        self.name = "Resize (Factor)"
        self.outputs = [ImageOutput()]
        self.icon = "MdOutlinePhotoSizeSelectLarge"
        self.sub = "Resize"

    def run(self, img: np.ndarray, scale: float, interpolation: int) -> np.ndarray:
        """Takes an image and resizes it"""

        logger.info(f"Resizing image by {scale} via {interpolation}")

        h, w = img.shape[:2]
        out_dims = (
            math.ceil(w * (scale / 100)) or 1,
            math.ceil(h * (scale / 100)) or 1,
        )

        return resize(img, out_dims, interpolation)


@NodeFactory.register("chainner:image:resize_resolution")
class ImResizeToResolutionNode(NodeBase):
    """OpenCV resize node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = (
            "Resize an image to an exact resolution. "
            "Auto uses box for downsampling and lanczos for upsampling."
        )
        self.inputs = [
            ImageInput(),
            NumberInput("Width", minimum=1, default=1, units="px"),
            NumberInput("Height", minimum=1, default=1, units="px"),
            InterpolationInput(),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_DIMENSION
        self.name = "Resize (Resolution)"
        self.icon = "MdOutlinePhotoSizeSelectLarge"
        self.sub = "Resize"

    def run(
        self, img: np.ndarray, width: int, height: int, interpolation: int
    ) -> np.ndarray:
        """Takes an image and resizes it"""

        logger.info(f"Resizing image to {width}x{height} via {interpolation}")

        out_dims = (width, height)

        return resize(img, out_dims, interpolation)


@NodeFactory.register("chainner:image:crop_offsets")
class CropNode(NodeBase):
    """NumPy Crop node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Crop an image based on offset from the top-left corner, and the wanted resolution."
        self.inputs = [
            ImageInput(),
            NumberInput("Top Offset", minimum=0, units="px"),
            NumberInput("Left Offset", minimum=0, units="px"),
            NumberInput("Height", minimum=0, units="px"),
            NumberInput("Width", minimum=0, units="px"),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_DIMENSION
        self.name = "Crop (Offsets)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(
        self, img: np.ndarray, top: int, left: int, height: int, width: int
    ) -> np.ndarray:
        """Crop an image"""

        h, w = img.shape[:2]

        assert top < h, "Cropped area would result in image with no height"
        assert left < w, "Cropped area would result in image with no width"

        result = img[top : top + height, left : left + width]

        return result


@NodeFactory.register("chainner:image:crop_border")
class BorderCropNode(NodeBase):
    """NumPy Border Crop node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = (
            "Crop an image based on a constant border margin around the entire image."
        )
        self.inputs = [
            ImageInput(),
            NumberInput("Amount", minimum=0, units="px"),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_DIMENSION
        self.name = "Crop (Border)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(self, img: np.ndarray, amount: int) -> np.ndarray:
        """Crop an image"""

        h, w = img.shape[:2]

        assert 2 * amount < h, "Cropped area would result in image with no height"
        assert 2 * amount < w, "Cropped area would result in image with no width"

        result = img[amount : h - amount, amount : w - amount]

        return result


@NodeFactory.register("chainner:image:crop_edges")
class EdgeCropNode(NodeBase):
    """NumPy Edge Crop node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Crop an image using separate amounts from each edge."
        self.inputs = [
            ImageInput(),
            NumberInput("Top", minimum=0, units="px"),
            NumberInput("Left", minimum=0, units="px"),
            NumberInput("Right", minimum=0, units="px"),
            NumberInput("Bottom", minimum=0, units="px"),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_DIMENSION
        self.name = "Crop (Edges)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(
        self, img: np.ndarray, top: str, left: str, right: str, bottom: str
    ) -> np.ndarray:
        """Crop an image"""

        h, w = img.shape[:2]

        assert top + bottom < h, "Cropped area would result in image with no height"
        assert left + right < w, "Cropped area would result in image with no width"

        result = img[top : h - bottom, left : w - right]

        return result
