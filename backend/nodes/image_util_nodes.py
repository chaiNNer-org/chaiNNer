from __future__ import annotations

import math

import cv2
import numpy as np
from sanic.log import logger

from .categories import IMAGE_UTILITY
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.image_utils import normalize, with_background
from .utils.pil_utils import *


@NodeFactory.register("chainner:image:overlay")
class ImOverlay(NodeBase):
    """OpenCV transparency overlay node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Overlay transparent images on base image."
        self.inputs = [
            ImageInput("Base"),
            ImageInput("Overlay A"),
            SliderInput("Opacity A", default=50, min_val=1, max_val=100),
            ImageInput("Overlay B ", optional=True),
            SliderInput("Opacity B", default=50, min_val=1, max_val=100, optional=True),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Overlay Images"
        self.icon = "BsLayersHalf"
        self.sub = "Compositing"

    def run(
        self,
        base: np.ndarray,
        ov1: np.ndarray,
        op1: int = 50,
        ov2: np.ndarray = None,
        op2: int = 50,
    ) -> np.ndarray:
        """Overlay transparent images on base image"""

        base = normalize(base)
        ov1 = normalize(ov1)
        if ov2 is not None:
            ov2 = normalize(ov2)

        # Convert to 0.0-1.0 range
        op1 = int(op1) / 100
        if op2 is not None:
            op2 = int(op2) / 100

        imgs = []
        max_h, max_w, max_c = 0, 0, 1
        for img in base, ov1, ov2:
            if img is not None:
                h, w = img.shape[:2]
                max_h = max(h, max_h)
                max_w = max(w, max_w)

                # All inputs must be BGRA for alpha compositing to work
                if img.ndim == 2 or img.shape[2] == 1:
                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
                elif img.shape[2] == 3:
                    img = np.dstack((img, np.ones((h, w), np.float32)))
                elif img.shape[2] != 4:  # Explode if there are not 1, 3, or 4 channels
                    logger.error(f"Number of channels ({img.shape[2]}) unexpected")

                imgs.append(img)
        else:
            assert (
                base.shape[0] >= max_h and base.shape[1] >= max_w
            ), "Base must be largest image."

        imgout = imgs[0]
        imgs = imgs[1:]

        center_x = imgout.shape[1] // 2
        center_y = imgout.shape[0] // 2

        for img, op in zip(imgs, (op1, op2)):
            h, w = img.shape[:2]

            # Center overlay
            x_offset = center_x - (w // 2)
            y_offset = center_y - (h // 2)

            img[:, :, 3] = img[:, :, 3] * op
            with_background(
                img, imgout[y_offset : y_offset + h, x_offset : x_offset + w]
            )
            imgout[y_offset : y_offset + h, x_offset : x_offset + w] = img

        imgout = np.clip(imgout, 0, 1)

        return imgout


@NodeFactory.register("chainner:image:stack")
class StackNode(NodeBase):
    """OpenCV concatenate (h/v) Node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Concatenate multiple images horizontally."
        self.inputs = [
            ImageInput("Image A"),
            ImageInput("Image B", optional=True),
            ImageInput("Image C", optional=True),
            ImageInput("Image D", optional=True),
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
        im2: np.ndarray = None,
        im3: np.ndarray = None,
        im4: np.ndarray = None,
        orientation: str = "horizontal",
    ) -> np.ndarray:
        """Concatenate multiple images horizontally"""

        imgs = []
        max_h, max_w, max_c = 0, 0, 1
        for img in im1, im2, im3, im4:
            if img is not None and type(img) != str:
                h, w = img.shape[:2]
                if img.ndim == 2:  # len(img.shape) needs to be 3, grayscale len only 2
                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
                c = img.shape[2]
                max_h = max(h, max_h)
                max_w = max(w, max_w)
                max_c = max(c, max_c)
                imgs.append(img)
            # dirty fix for problem with optional inputs and them just being positional
            # TODO: make the inputs named instead of positional
            elif type(img) == str and img in ["horizontal", "vertical"]:
                orientation = img

        fixed_imgs = []
        for img in imgs:
            h, w = img.shape[:2]
            c = img.shape[2] or 1

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
            img = cv2.hconcat(fixed_imgs)
        elif orientation == "vertical":
            for i in range(len(fixed_imgs)):
                assert (
                    fixed_imgs[i].shape[1] == fixed_imgs[0].shape[1]
                ), "Inputted widths are not the same and could not be auto-fixed"
                assert (
                    fixed_imgs[i].dtype == fixed_imgs[0].dtype
                ), "The image types are not the same and could not be auto-fixed"
            img = cv2.vconcat(fixed_imgs)

        return img


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

    def run(self, img: np.ndarray, caption: str) -> np.ndarray:
        """Add caption an image"""

        img = normalize(img)

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

    def run(self, img: np.ndarray, color_mode: int) -> np.ndarray:
        """Takes an image and changes the color mode it"""

        result = cv2.cvtColor(img, int(color_mode))

        return result


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
            IntegerInput("Amount"),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Create Border"
        self.icon = "BsBorderOuter"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray, border_type: int, amount: int) -> np.ndarray:
        """Takes an image and applies a border to it"""

        amount = int(amount)
        border_type = int(border_type)

        if (img.ndim == 3 and img.shape[2] == 4) and border_type == cv2.BORDER_CONSTANT:
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
            None,
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
            BoundlessIntegerInput("Amount X"),
            BoundlessIntegerInput("Amount Y"),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Shift"
        self.icon = "BsGraphDown"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        amount_x: int,
        amount_y: int,
    ) -> np.ndarray:
        """Adjusts the position of an image"""

        num_rows, num_cols = img.shape[:2]
        translation_matrix = np.float32([[1, 0, amount_x], [0, 1, amount_y]])
        img = cv2.warpAffine(img, translation_matrix, (num_cols, num_rows))
        return img
