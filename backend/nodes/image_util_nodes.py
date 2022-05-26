from __future__ import annotations

import math
from typing import List

import cv2
import numpy as np
from sanic.log import logger

from .categories import IMAGE_UTILITY
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.image_utils import with_background
from .utils.pil_utils import *
from .utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:overlay")
class ImOverlay(NodeBase):
    """OpenCV transparency overlay node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Overlay transparent images on base image."
        self.inputs = [
            ImageInput("Base").with_id(0),
            SliderInput(
                "Base Opacity",
                maximum=100,
                default=100,
                step=0.1,
                controls_step=1,
                unit="%",
            ).with_id(5),
            ImageInput("Overlay A").with_id(1),
            SliderInput(
                "Opacity A",
                maximum=100,
                default=50,
                step=0.1,
                controls_step=1,
                unit="%",
            ).with_id(2),
            ImageInput("Overlay B").make_optional().with_id(3),
            SliderInput(
                "Opacity B",
                maximum=100,
                default=50,
                step=0.1,
                controls_step=1,
                unit="%",
            ).with_id(4),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Overlay Images"
        self.icon = "BsLayersHalf"
        self.sub = "Compositing"

    def run(
        self,
        base: np.ndarray,
        opbase: float,
        ov1: np.ndarray,
        op1: float,
        ov2: Union[np.ndarray, None],
        op2: float,
    ) -> np.ndarray:
        """Overlay transparent images on base image"""

        # Convert to 0.0-1.0 range
        opbase /= 100
        op1 /= 100
        op2 /= 100

        imgs = []
        max_h, max_w = 0, 0
        for img in base, ov1, ov2:
            if img is not None:
                h, w, c = get_h_w_c(img)
                max_h = max(h, max_h)
                max_w = max(w, max_w)

                # All inputs must be BGRA for alpha compositing to work
                if c == 1:
                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
                elif c == 3:
                    img = np.dstack((img, np.ones((h, w), np.float32)))
                elif c != 4:  # Explode if there are not 1, 3, or 4 channels
                    logger.error(f"Number of channels ({c}) unexpected")

                imgs.append(img)
        assert (
            base.shape[0] >= max_h and base.shape[1] >= max_w
        ), "Base must be largest image."

        imgout = imgs[0]
        imgs = imgs[1:]

        center_x = imgout.shape[1] // 2
        center_y = imgout.shape[0] // 2

        # Apply opacity to base, then overlay A and B sequentially at corresponding opacities
        imgout[:, :, 3] *= opbase
        for img, op in zip(imgs, (op1, op2)):
            h, w, _ = get_h_w_c(img)

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
        im2: Union[np.ndarray, None],
        im3: Union[np.ndarray, None],
        im4: Union[np.ndarray, None],
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
            NumberInput("Amount", unit="px"),
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
        img: np.ndarray,
        amount_x: int,
        amount_y: int,
    ) -> np.ndarray:
        """Adjusts the position of an image"""

        h, w, _ = get_h_w_c(img)
        translation_matrix = np.float32([[1, 0, amount_x], [0, 1, amount_y]])  # type: ignore
        img = cv2.warpAffine(img, translation_matrix, (w, h))
        return img


@NodeFactory.register("chainner:image:difference")
class DifferenceNode(NodeBase):
    """OpenCV absdiff node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Compares two images."
        self.inputs = [ImageInput("Image A"), ImageInput("Image B")]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_UTILITY
        self.name = "Difference"
        self.icon = "BsSubtract"
        self.sub = "Miscellaneous"

    def run(self, img_1: np.ndarray, img_2: np.ndarray) -> np.ndarray:
        """Compares two images"""
        assert img_1.shape == img_2.shape, "Images must be the same size"
        return cv2.absdiff(img_1, img_2)


@NodeFactory.register("chainner:image:rotate")
class RotateNode(NodeBase):
    """flip node"""

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

    def run(self, img: np.ndarray, rotateCode: int) -> np.ndarray:
        """Compares two images"""
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

    def run(self, img: np.ndarray, axis: int) -> np.ndarray:
        """Compares two images"""
        return cv2.flip(img, axis)
