from __future__ import annotations

import math
from typing import List, Tuple

import cv2
import numpy as np
import numpy.typing as npt
from sanic.log import logger

from .categories import IMAGE_UTILITY
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.image_utils import blend_images, calculate_ssim
from .utils.pil_utils import *
from .utils.utils import get_h_w_c

ndarray32 = npt.NDArray[np.float32]


@NodeFactory.register("chainner:image:blend")
class ImBlend(NodeBase):
    """Blending mode node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = """Blends overlay image onto base image using 
            specified mode and opacities."""
        self.inputs = [
            ImageInput("Base"),
            SliderInput(
                "Base Opacity",
                maximum=100,
                default=100,
                step=0.1,
                controls_step=1,
                unit="%",
            ).with_id(2),
            ImageInput("Overlay").make_optional().with_id(1),
            SliderInput(
                "Overlay Opacity",
                maximum=100,
                default=100,
                step=0.1,
                controls_step=1,
                unit="%",
            ),
            BlendModeDropdown(),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Blend Images"
        self.icon = "BsLayersHalf"
        self.sub = "Compositing"

    def run(
        self,
        base: ndarray32,
        opbase: float,
        ov: ndarray32 | None,
        op: float,
        blend_mode: int,
    ) -> ndarray32:
        """Blend images together"""

        # Return base image * base opacity if there is no overlay image.
        if ov is None:
            if get_h_w_c(base)[2] == 4:
                base[:, :, 3] *= opbase / 100
            return base

        # Convert to 0.0-1.0 range
        opbase /= 100
        op /= 100

        imgs = []
        max_h = max_w = 0
        for img in (base, ov):  # Using loops in case variable inputs possible later.
            if img is not None:
                h, w, c = get_h_w_c(img)
                max_h = max(h, max_h)
                max_w = max(w, max_w)

                # All inputs must be BGRA for alpha compositing to work
                if c == 1:
                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
                elif c == 3:
                    img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
                elif c != 4:  # Explode if there are not 1, 3, or 4 channels
                    logger.error(f"Number of channels ({c}) unexpected")

                imgs.append(img)

        imgout = imgs[0]
        imgs = imgs[1:]

        # Pad base image with transparency if necessary to match size with overlay
        h, w, _ = get_h_w_c(imgout)
        tp = bm = lt = rt = 0
        if h < max_h:
            tp = (max_h - h) // 2
            bm = max_h - h - tp
        if w < max_w:
            lt = (max_w - w) // 2
            rt = max_w - w - lt
        imgout = cv2.copyMakeBorder(
            imgout, tp, bm, lt, rt, cv2.BORDER_CONSTANT, value=0
        )

        center_x = imgout.shape[1] // 2
        center_y = imgout.shape[0] // 2

        # Apply opacity to base, then blend overlay at specified opacity
        imgout[:, :, 3] *= opbase
        for img, op in zip(imgs, [op]):
            h, w, _ = get_h_w_c(img)

            # Center overlay
            x_offset = center_x - (w // 2)
            y_offset = center_y - (h // 2)

            img[:, :, 3] = img[:, :, 3] * op
            img = blend_images(
                img,
                imgout[y_offset : y_offset + h, x_offset : x_offset + w],
                blend_mode,
            )

            imgout[y_offset : y_offset + h, x_offset : x_offset + w] = img
        img = np.clip(imgout, 0, 1)

        return img


@NodeFactory.register("chainner:image:stack")
class StackNode(NodeBase):
    """OpenCV concatenate (h/v) Node"""

    def __init__(self):
        """Constructor"""
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
        im1: ndarray32,
        im2: ndarray32 | None,
        im3: ndarray32 | None,
        im4: ndarray32 | None,
        orientation: str,
    ) -> ndarray32:
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
    """Caption node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Add a caption to an image."
        self.inputs = [
            ImageInput(),
            TextInput("Caption"),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Add Caption"
        self.icon = "MdVideoLabel"
        self.sub = "Compositing"

    def run(self, img: ndarray32, caption: str) -> ndarray32:
        """Add caption an image"""

        return add_caption(img, caption)


@NodeFactory.register("chainner:image:change_colorspace")
class ColorConvertNode(NodeBase):
    """OpenCV color conversion node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = (
            "Convert the colorspace of an image to a different one. "
            "Also can convert to different channel-spaces."
        )
        self.inputs = [
            ImageInput(),
            ColorModeInput(),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Change Colorspace"
        self.icon = "MdColorLens"
        self.sub = "Miscellaneous"

    def run(self, img: ndarray32, color_mode: int) -> ndarray32:
        """Takes an image and changes the color mode it"""

        result = cv2.cvtColor(img, int(color_mode))

        return result  # type: ignore


@NodeFactory.register("chainner:image:create_border")
class BorderMakeNode(NodeBase):
    """OpenCV CopyMakeBorder node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Creates a border around the image."
        self.inputs = [
            ImageInput(),
            BorderInput(),
            NumberInput("Amount", unit="px"),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Create Border"
        self.icon = "BsBorderOuter"
        self.sub = "Miscellaneous"

    def run(self, img: ndarray32, border_type: int, amount: int) -> ndarray32:
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
    """OpenCV Shift Node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Shift an image by an x, y amount."
        self.inputs = [
            ImageInput(),
            NumberInput("Amount X", unit="px"),
            NumberInput("Amount Y", unit="px"),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Shift"
        self.icon = "BsGraphDown"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: ndarray32,
        amount_x: int,
        amount_y: int,
    ) -> ndarray32:
        """Adjusts the position of an image"""

        h, w, _ = get_h_w_c(img)
        translation_matrix = np.float32([[1, 0, amount_x], [0, 1, amount_y]])  # type: ignore
        img = cv2.warpAffine(img, translation_matrix, (w, h))
        return img


@NodeFactory.register("chainner:image:rotate")
class RotateNode(NodeBase):
    """Rotate node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Rotate an image."
        self.inputs = [
            ImageInput("Image"),
            DropDownInput(
                "Rotation Degree",
                [
                    {"option": "90", "value": cv2.ROTATE_90_CLOCKWISE},
                    {"option": "180", "value": cv2.ROTATE_180},
                    {"option": "270", "value": cv2.ROTATE_90_COUNTERCLOCKWISE},
                ],
            ),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Rotate"
        self.icon = "MdRotate90DegreesCcw"
        self.sub = "Modification"

    def run(self, img: ndarray32, rotateCode: int) -> ndarray32:
        return cv2.rotate(img, rotateCode)


@NodeFactory.register("chainner:image:flip")
class FlipNode(NodeBase):
    """flip node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Flip an image."
        self.inputs = [
            ImageInput("Image"),
            DropDownInput(
                "Flip Axis",
                [
                    {"option": "Horizontal", "value": 1},
                    {"option": "Vertical", "value": 0},
                    {"option": "Both", "value": -1},
                ],
            ),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Flip"
        self.icon = "MdFlip"
        self.sub = "Modification"

    def run(self, img: ndarray32, axis: int) -> ndarray32:
        return cv2.flip(img, axis)


@NodeFactory.register("chainner:image:image_metrics")
class ImageMetricsNode(NodeBase):
    """Calculate image quality metrics of modified image."""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = (
            """Calculate image quality metrics (MSE, PSNR, SSIM) between two images."""
        )
        self.inputs = [
            ImageInput("Original Image"),
            ImageInput("Comparison Image"),
        ]
        self.outputs = [
            TextOutput("MSE"),
            TextOutput("PSNR"),
            TextOutput("SSIM"),
        ]
        self.category = IMAGE_UTILITY
        self.name = "Image Metrics"
        self.icon = "MdOutlineAssessment"
        self.sub = "Miscellaneous"

    def run(self, orig_img: ndarray32, comp_img: ndarray32) -> Tuple[str, str, str]:
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

        mse = round(np.mean((comp_img - orig_img) ** 2), 6)
        psnr = round(10 * math.log(1 / mse), 6)
        ssim = round(calculate_ssim(comp_img, orig_img), 6)

        return (str(mse), str(psnr), str(ssim))
