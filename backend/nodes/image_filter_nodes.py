from __future__ import annotations

import cv2
import numpy as np

from .categories import IMAGE_FILTER
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.color_transfer import color_transfer
from .utils.image_utils import normalize
from .utils.pil_utils import *


@NodeFactory.register("chainner:image:blur")
class BlurNode(NodeBase):
    """OpenCV Blur Node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Apply blur to an image"
        self.inputs = [
            ImageInput(),
            IntegerInput("Amount X"),
            IntegerInput("Amount Y"),
        ]  # , IntegerInput("Sigma")]#,BlurInput()]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_FILTER
        self.name = "Blur"
        self.icon = "MdBlurOn"
        self.sub = "Blur/Sharpen"

    def run(
        self,
        img: np.ndarray,
        amount_x: int,
        amount_y: int,
        # sigma: int,
    ) -> np.ndarray:
        """Adjusts the blur of an image"""

        ksize = (int(amount_x), int(amount_y))
        for __i in range(16):
            img = cv2.blur(img, ksize)

        return img


@NodeFactory.register("chainner:image:gaussian_blur")
class GaussianBlurNode(NodeBase):
    """OpenCV Gaussian Blur Node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Apply Gaussian Blur to an image"
        self.inputs = [
            ImageInput(),
            IntegerInput("Amount X"),
            IntegerInput("Amount Y"),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_FILTER
        self.name = "Gaussian Blur"
        self.icon = "MdBlurOn"
        self.sub = "Blur/Sharpen"

    def run(
        self,
        img: np.ndarray,
        amount_x: float,
        amount_y: float,
    ) -> np.ndarray:
        """Adjusts the sharpening of an image"""

        blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=amount_x, sigmaY=amount_y)

        return blurred


@NodeFactory.register("chainner:image:sharpen")
class SharpenNode(NodeBase):
    """OpenCV Sharpen Node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Apply sharpening to an image"
        self.inputs = [
            ImageInput(),
            IntegerInput("Amount"),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_FILTER
        self.name = "Sharpen"
        self.icon = "MdBlurOff"
        self.sub = "Blur/Sharpen"

    def run(
        self,
        img: np.ndarray,
        amount: float,
    ) -> np.ndarray:
        """Adjusts the sharpening of an image"""

        blurred = cv2.GaussianBlur(img, (0, 0), amount)
        img = cv2.addWeighted(img, 2.0, blurred, -1.0, 0)

        return img


@NodeFactory.register("chainner:image:average_color_fix")
class AverageColorFixNode(NodeBase):
    """Fixes the average color of an upscaled image"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = """Correct for upscaling model color shift by matching
         average color of Input Image to that of a smaller Reference Image.
         Using significant downscaling increases generalization of averaging effect
         and can reduce artifacts in the output."""
        self.inputs = [
            ImageInput("Image"),
            ImageInput("Reference Image"),
            BoundedNumberInput(
                "Reference Image Scale Factor", default=0.125, step=0.125
            ),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_FILTER
        self.name = "Average Color Fix"
        self.icon = "MdAutoFixHigh"
        self.sub = "Correction"

    def run(
        self, input_img: np.ndarray, ref_img: np.ndarray, scale_factor: float
    ) -> np.ndarray:
        """Fixes the average color of the input image"""

        input_img = normalize(input_img)
        ref_img = normalize(ref_img)

        if scale_factor != 1.0:
            ref_img = cv2.resize(
                ref_img,
                None,
                fx=scale_factor,
                fy=scale_factor,
                interpolation=cv2.INTER_AREA,
            )

        input_h, input_w = input_img.shape[:2]
        ref_h, ref_w = ref_img.shape[:2]

        assert (
            ref_w < input_w and ref_h < input_h
        ), "Image must be larger than Reference Image"

        # Find the diff of both images

        # Downscale the input image
        downscaled_input = cv2.resize(
            input_img,
            (ref_w, ref_h),
            interpolation=cv2.INTER_AREA,
        )

        # Get difference between the reference image and downscaled input
        downscaled_diff = ref_img - downscaled_input

        # Upsample the difference
        diff = cv2.resize(
            downscaled_diff,
            (input_w, input_h),
            interpolation=cv2.INTER_CUBIC,
        )

        result = input_img + diff

        return np.clip(result, 0, 1)


@NodeFactory.register("chainner:image:color_transfer")
class ColorTransferNode(NodeBase):
    """
    Transfers colors from one image to another

    This code was adapted from Adrian Rosebrock's color_transfer script,
    found at: https://github.com/jrosebr1/color_transfer (© 2014, MIT license).
    """

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = """Transfers colors from reference image.
            Different combinations of settings may perform better for
            different images. Try multiple setting combinations to find
            best results."""
        self.inputs = [
            ImageInput("Image"),
            ImageInput("Reference Image"),
            DropDownInput(
                "str",
                "Colorspace",
                [
                    {"option": "L*a*b*", "value": "L*a*b*"},
                    {"option": "RGB", "value": "RGB"},
                ],
            ),
            DropDownInput(
                "str",
                "Overflow Method",
                [
                    {"option": "Clip", "value": 1},
                    {"option": "Scale", "value": 0},
                ],
            ),
            DropDownInput(
                "generic",
                "Reciprocal Scaling Factor",
                [
                    {"option": "Yes", "value": 1},
                    {"option": "No", "value": 0},
                ],
            ),
        ]
        self.outputs = [ImageOutput("Image")]
        self.category = IMAGE_FILTER
        self.name = "Color Transfer"
        self.icon = "MdInput"
        self.sub = "Correction"

    def run(
        self,
        img: np.ndarray,
        ref_img: np.ndarray,
        colorspace: str = "L*a*b*",
        overflow_method: int | str = 1,
        reciprocal_scale: int | str = 1,
    ) -> np.ndarray:
        """
        Transfers the color distribution from source image to target image.
        """

        assert (
            ref_img.ndim == 3 and ref_img.shape[2] >= 3
        ), "Reference image should be RGB or RGBA"

        img = normalize(img)
        ref_img = normalize(ref_img)

        # Make sure target has at least 3 channels
        if img.ndim == 2 or img.shape[2] == 1:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

        # Preserve alpha
        c = img.shape[2]
        alpha = None
        if c == 4:
            alpha = img[:, :, 3]

        transfer = color_transfer(
            img, ref_img, colorspace, overflow_method, reciprocal_scale
        )

        if alpha is not None:
            transfer = np.dstack((transfer, alpha))

        return transfer
