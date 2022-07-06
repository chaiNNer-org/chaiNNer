from __future__ import annotations

import math
from typing import List, Tuple

import cv2
import numpy as np

from .categories import IMAGE_UTILITY
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.image_utils import (
    blend_images,
    calculate_ssim,
    convert_from_BGRA,
    convert_to_BGRA,
    shift,
)
from .utils.pil_utils import *
from .utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:blend")
class ImBlend(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Blends overlay image onto base image using
            specified mode."""
        self.inputs = [
            ImageInput("Base Layer"),
            ImageInput("Overlay Layer"),
            BlendModeDropdown(),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width=expression.fn("max", "Input0.width", "Input1.width"),
                    height=expression.fn("max", "Input0.height", "Input1.height"),
                    channels=expression.fn("max", "Input0.channels", "Input1.channels"),
                )
            ),
        ]
        self.category = IMAGE_UTILITY
        self.name = "Blend Images"
        self.icon = "BsLayersHalf"
        self.sub = "Compositing"

    def run(
        self,
        base: np.ndarray,
        ov: np.ndarray,
        blend_mode: int,
    ) -> np.ndarray:
        """Blend images together"""

        b_h, b_w, b_c = get_h_w_c(base)
        o_h, o_w, o_c = get_h_w_c(ov)
        max_h = max(b_h, o_h)
        max_w = max(b_w, o_w)
        max_c = max(b_c, o_c)

        # All inputs must be BGRA for alpha compositing to work
        imgout = convert_to_BGRA(base, b_c)
        ov_img = convert_to_BGRA(ov, o_c)

        # Pad base image with transparency if necessary to match size with overlay
        top = bottom = left = right = 0
        if b_h < max_h:
            top = (max_h - b_h) // 2
            bottom = max_h - b_h - top
        if b_w < max_w:
            left = (max_w - b_w) // 2
            right = max_w - b_w - left
        imgout = cv2.copyMakeBorder(
            imgout, top, bottom, left, right, cv2.BORDER_CONSTANT, value=0
        )

        # Center overlay
        center_x = imgout.shape[1] // 2
        center_y = imgout.shape[0] // 2
        x_offset = center_x - (o_w // 2)
        y_offset = center_y - (o_h // 2)

        blended_img = blend_images(
            ov_img,
            imgout[y_offset : y_offset + o_h, x_offset : x_offset + o_w],
            blend_mode,
        )

        imgout[y_offset : y_offset + o_h, x_offset : x_offset + o_w] = blended_img
        imgout = np.clip(imgout, 0, 1)

        if max_c < 4:
            imgout = convert_from_BGRA(imgout, max_c)

        return imgout


@NodeFactory.register("chainner:image:stack")
class StackNode(NodeBase):
    """OpenCV concatenate (h/v) Node"""

    def __init__(self):
        super().__init__()
        self.description = "Concatenate multiple images horizontally."
        self.inputs = [
            ImageInput("Image A"),
            ImageInput("Image B").make_optional(),
            ImageInput("Image C").make_optional(),
            ImageInput("Image D").make_optional(),
            StackOrientationDropdown(),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Stack Images"
        self.icon = "CgMergeVertical"
        self.sub = "Compositing"

    def run(
        self,
        im1: np.ndarray,
        im2: np.ndarray | None,
        im3: np.ndarray | None,
        im4: np.ndarray | None,
        orientation: str,
    ) -> np.ndarray:
        """Concatenate multiple images horizontally"""
        img = im1
        imgs = []
        max_h, max_w, max_c = 0, 0, 1
        for img in im1, im2, im3, im4:
            if img is not None and not isinstance(img, str):
                h, w, c = get_h_w_c(img)
                if c == 1:
                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
                max_h = max(h, max_h)
                max_w = max(w, max_w)
                max_c = max(c, max_c)
                imgs.append(img)
            # dirty fix for problem with optional inputs and them just being positional
            # TODO: Check if this is still needed or if that null stuff made it obsolete
            elif isinstance(img, str) and img in ["horizontal", "vertical"]:
                orientation = img

        fixed_imgs: List[np.ndarray] = []
        for img in imgs:
            h, w, c = get_h_w_c(img)

            fixed_img = img
            # Fix images so they resize proportionally to the max image
            if orientation == "horizontal":
                if h < max_h:
                    ratio = max_h / h
                    fixed_img = cv2.resize(
                        img,
                        (math.ceil(w * ratio), max_h),
                        interpolation=cv2.INTER_NEAREST,
                    )
            elif orientation == "vertical":
                if w < max_w:
                    ratio = max_w / w
                    fixed_img = cv2.resize(
                        img,
                        (max_w, math.ceil(h * ratio)),
                        interpolation=cv2.INTER_NEAREST,
                    )

            # Expand channel dims if necessary
            if c < max_c:
                temp_img = np.ones((max_h, max_w, max_c))
                temp_img[:, :, :c] = fixed_img
                fixed_img = temp_img

            fixed_imgs.append(fixed_img.astype("float32"))

        if orientation == "horizontal":
            for i in range(len(fixed_imgs)):
                assert (
                    fixed_imgs[i].shape[0] == fixed_imgs[0].shape[0]
                ), "Inputted heights are not the same and could not be auto-fixed"
                assert (
                    fixed_imgs[i].dtype == fixed_imgs[0].dtype
                ), "The image types are not the same and could not be auto-fixed"
            img = cv2.hconcat(fixed_imgs)  # type: ignore
        elif orientation == "vertical":
            for i in range(len(fixed_imgs)):
                assert (
                    fixed_imgs[i].shape[1] == fixed_imgs[0].shape[1]
                ), "Inputted widths are not the same and could not be auto-fixed"
                assert (
                    fixed_imgs[i].dtype == fixed_imgs[0].dtype
                ), "The image types are not the same and could not be auto-fixed"
            img = cv2.vconcat(fixed_imgs)  # type: ignore

        return img  # type: ignore


@NodeFactory.register("chainner:image:caption")
class CaptionNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Add a caption to an image."
        self.inputs = [
            ImageInput(),
            TextInput("Caption", allow_numbers=True),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Add Caption"
        self.icon = "MdVideoLabel"
        self.sub = "Compositing"

    def run(self, img: np.ndarray, caption: str) -> np.ndarray:
        """Add caption an image"""

        return add_caption(img, caption)


@NodeFactory.register("chainner:image:change_colorspace")
class ColorConvertNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Convert the colorspace of an image to a different one. "
            "Also can convert to different channel-spaces."
        )
        self.inputs = [
            ImageInput(),
            ColorModeInput(),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    size_as="Input0",
                    channels="Input1.outputChannels",
                )
            )
        ]
        self.category = IMAGE_UTILITY
        self.name = "Change Colorspace"
        self.icon = "MdColorLens"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray, color_mode: int) -> np.ndarray:
        """Takes an image and changes the color mode it"""

        result = cv2.cvtColor(img, int(color_mode))

        return result


@NodeFactory.register("chainner:image:create_border")
class BorderMakeNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Creates a border around the image."
        self.inputs = [
            ImageInput(),
            BorderInput(),
            NumberInput("Amount", unit="px"),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width=expression.fn(
                        "add",
                        "Input0.width",
                        expression.fn("multiply", "Input2", 2),
                    ),
                    height=expression.fn(
                        "add",
                        "Input0.height",
                        expression.fn("multiply", "Input2", 2),
                    ),
                )
            )
        ]
        self.category = IMAGE_UTILITY
        self.name = "Create Border"
        self.icon = "BsBorderOuter"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray, border_type: int, amount: int) -> np.ndarray:
        """Takes an image and applies a border to it"""

        amount = int(amount)
        border_type = int(border_type)

        _, _, c = get_h_w_c(img)
        if c == 4 and border_type == cv2.BORDER_CONSTANT:
            value = (0, 0, 0, 1)
        else:
            value = 0

        if border_type == cv2.BORDER_TRANSPARENT:
            border_type = cv2.BORDER_CONSTANT

        result = cv2.copyMakeBorder(
            img,
            amount,
            amount,
            amount,
            amount,
            border_type,
            value=value,
        )

        return result


@NodeFactory.register("chainner:image:shift")
class ShiftNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Shift an image by an x, y amount."
        self.inputs = [
            ImageInput(),
            NumberInput("Amount X", minimum=None, unit="px"),
            NumberInput("Amount Y", minimum=None, unit="px"),
            FillColorDropdown(),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = IMAGE_UTILITY
        self.name = "Shift"
        self.icon = "BsGraphDown"
        self.sub = "Modification"

    def run(
        self,
        img: np.ndarray,
        amount_x: int,
        amount_y: int,
        fill: int,
    ) -> np.ndarray:
        return shift(img, amount_x, amount_y, fill)


@NodeFactory.register("chainner:image:rotate")
class RotateNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Rotate an image."
        self.inputs = [
            ImageInput("Image"),
            SliderInput(
                "Rotation Angle",
                default=0,
                maximum=360,
                step=0.1,
                controls_step=45,
                slider_step=1,
                unit="°",
            ),
            RotateInterpolationInput(),
            DropDownInput(
                input_type="RotateExpandCrop",
                label="Image Dimensions",
                options=[
                    {"option": "Expand to fit", "value": RotateExpandCrop.EXPAND},
                    {"option": "Crop to original", "value": RotateExpandCrop.CROP},
                ],
            ),
            FillColorDropdown(),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Rotate"
        self.icon = "MdRotate90DegreesCcw"
        self.sub = "Modification"

    def run(
        self, img: np.ndarray, angle: float, interpolation: int, expand: int, fill: int
    ) -> np.ndarray:
        return rotate(img, angle, interpolation, expand, fill)


@NodeFactory.register("chainner:image:flip")
class FlipNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Flip an image."
        self.inputs = [
            ImageInput("Image"),
            FlipAxisInput(),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width=["Input0.width", "Input0.height"],
                    height=["Input0.width", "Input0.height"],
                    channels_as="Input0",
                )
            )
        ]
        self.category = IMAGE_UTILITY
        self.name = "Flip"
        self.icon = "MdFlip"
        self.sub = "Modification"

    def run(self, img: np.ndarray, axis: int) -> np.ndarray:
        return cv2.flip(img, axis)


@NodeFactory.register("chainner:image:image_metrics")
class ImageMetricsNode(NodeBase):
    """Calculate image quality metrics of modified image."""

    def __init__(self):
        super().__init__()
        self.description = (
            """Calculate image quality metrics (MSE, PSNR, SSIM) between two images."""
        )
        self.inputs = [
            ImageInput("Original Image"),
            ImageInput("Comparison Image"),
        ]
        self.outputs = [
            NumberOutput("MSE", expression.interval(0, 1)),
            NumberOutput("PSNR", expression.interval(0, float("inf"))),
            NumberOutput("SSIM", expression.interval(0, 1)),
        ]
        self.category = IMAGE_UTILITY
        self.name = "Image Metrics"
        self.icon = "MdOutlineAssessment"
        self.sub = "Miscellaneous"

    def run(
        self, orig_img: np.ndarray, comp_img: np.ndarray
    ) -> Tuple[float, float, float]:
        """Compute MSE, PSNR, and SSIM"""

        assert (
            orig_img.shape == comp_img.shape
        ), "Images must have same dimensions and color depth"

        # If an image is not grayscale, convert to YCrCb and compute metrics
        # on luma channel only
        c = get_h_w_c(orig_img)[2]
        if c > 1:
            orig_img = cv2.cvtColor(orig_img, cv2.COLOR_BGR2YCrCb)[:, :, 0]
            comp_img = cv2.cvtColor(comp_img, cv2.COLOR_BGR2YCrCb)[:, :, 0]

        mse = round(np.mean((comp_img - orig_img) ** 2), 6)  # type: ignore
        psnr = round(10 * math.log(1 / mse), 6)
        ssim = round(calculate_ssim(comp_img, orig_img), 6)

        return (float(mse), float(psnr), ssim)
