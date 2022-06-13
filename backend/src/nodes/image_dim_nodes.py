from __future__ import annotations

from typing import Tuple

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
from .utils.utils import get_h_w_c


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
                step=0.0001,
                controls_step=25.0,
                default=100.0,
                unit="%",
            ),
            InterpolationInput(),
        ]
        self.category = IMAGE_DIMENSION
        self.name = "Resize (Factor)"
        self.outputs = [ImageOutput(image_type=expression.Image(channels_as="Input0"))]
        self.icon = "MdOutlinePhotoSizeSelectLarge"
        self.sub = "Resize"

    def run(self, img: np.ndarray, scale: float, interpolation: int) -> np.ndarray:
        """Takes an image and resizes it"""

        logger.info(f"Resizing image by {scale} via {interpolation}")

        h, w, _ = get_h_w_c(img)
        out_dims = (
            max(round(w * (scale / 100)), 1),
            max(round(h * (scale / 100)), 1),
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
            NumberInput("Width", minimum=1, default=1, unit="px"),
            NumberInput("Height", minimum=1, default=1, unit="px"),
            InterpolationInput(),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input1",
                    height="Input2",
                    channels=expression.field("Input0", "channels"),
                )
            )
        ]
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


@NodeFactory.register("chainner:image:tile_fill")
class TileFillNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Tiles an image to an exact resolution."
        self.inputs = [
            ImageInput(),
            NumberInput("Width", minimum=1, default=1, unit="px"),
            NumberInput("Height", minimum=1, default=1, unit="px"),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input1",
                    height="Input2",
                    channels=expression.field("Input0", "channels"),
                )
            )
        ]
        self.category = IMAGE_DIMENSION
        self.name = "Tile Fill"
        self.icon = "MdWindow"
        self.sub = "Resize"

    def run(self, img: np.ndarray, width: int, height: int) -> np.ndarray:
        h, w, _ = get_h_w_c(img)

        # tile
        img = np.tile(img, (math.ceil(height / h), math.ceil(width / w), 1))

        # crop to make sure the dimensions are correct
        return img[:height, :width]


@NodeFactory.register("chainner:image:crop_offsets")
class CropNode(NodeBase):
    """NumPy Crop node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Crop an image based on offset from the top-left corner, and the wanted resolution."
        self.inputs = [
            ImageInput(),
            NumberInput("Top Offset", unit="px"),
            NumberInput("Left Offset", unit="px"),
            NumberInput("Height", unit="px"),
            NumberInput("Width", unit="px"),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input4", height="Input3", channels_as="Input0"
                )
            )
        ]
        self.category = IMAGE_DIMENSION
        self.name = "Crop (Offsets)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(
        self, img: np.ndarray, top: int, left: int, height: int, width: int
    ) -> np.ndarray:
        """Crop an image"""

        h, w, _ = get_h_w_c(img)

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
            NumberInput("Amount", unit="px"),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width=expression.intersect(
                        expression.fn(
                            "subtract",
                            expression.field("Input0", "width"),
                            expression.fn("add", "Input1", "Input1"),
                        ),
                        expression.int_interval(min=0, max=None),
                    ),
                    height=expression.intersect(
                        expression.fn(
                            "subtract",
                            expression.field("Input0", "height"),
                            expression.fn("add", "Input1", "Input1"),
                        ),
                        expression.int_interval(min=0, max=None),
                    ),
                    channels_as="Input0",
                )
            )
        ]
        self.category = IMAGE_DIMENSION
        self.name = "Crop (Border)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(self, img: np.ndarray, amount: int) -> np.ndarray:
        """Crop an image"""

        h, w, _ = get_h_w_c(img)

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
            NumberInput("Top", unit="px"),
            NumberInput("Left", unit="px"),
            NumberInput("Right", unit="px"),
            NumberInput("Bottom", unit="px"),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width=expression.intersect(
                        expression.fn(
                            "subtract",
                            expression.field("Input0", "width"),
                            expression.fn("add", "Input2", "Input3"),
                        ),
                        expression.int_interval(min=0, max=None),
                    ),
                    height=expression.intersect(
                        expression.fn(
                            "subtract",
                            expression.field("Input0", "height"),
                            expression.fn("add", "Input1", "Input4"),
                        ),
                        expression.int_interval(min=0, max=None),
                    ),
                    channels_as="Input0",
                )
            )
        ]
        self.category = IMAGE_DIMENSION
        self.name = "Crop (Edges)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(
        self, img: np.ndarray, top: int, left: int, right: int, bottom: int
    ) -> np.ndarray:
        """Crop an image"""

        h, w, _ = get_h_w_c(img)

        assert top + bottom < h, "Cropped area would result in image with no height"
        assert left + right < w, "Cropped area would result in image with no width"

        result = img[top : h - bottom, left : w - right]

        return result


@NodeFactory.register("chainner:image:get_dims")
class GetDimensionsNode(NodeBase):
    """Node for getting the dimensions of an image"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = (
            "Get the Height, Width, and number of Channels from an image."
        )
        self.inputs = [
            ImageInput(),
        ]
        self.outputs = [
            NumberOutput("Width", output_type=expression.field("Input0", "width")),
            NumberOutput("Height", output_type=expression.field("Input0", "height")),
            NumberOutput(
                "Channels", output_type=expression.field("Input0", "channels")
            ),
        ]
        self.category = IMAGE_DIMENSION
        self.name = "Get Dimensions"
        self.icon = "BsRulers"
        self.sub = "Utility"

    def run(
        self,
        img: np.ndarray,
    ) -> Tuple[int, int, int]:
        h, w, c = get_h_w_c(img)
        return w, h, c
