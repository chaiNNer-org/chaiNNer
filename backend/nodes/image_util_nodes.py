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
from .utils.image_utils import normalize, normalize_normals
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
                if img.ndim == 2:  # Overlay needs 3 dimensions for ease
                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
                h, w, c = img.shape
                max_h = max(h, max_h)
                max_w = max(w, max_w)
                max_c = max(c, max_c)
                imgs.append(img)
        else:
            assert (
                base.shape[0] >= max_h and base.shape[1] >= max_w
            ), "Base must be largest image."

        # Expand channels if necessary
        channel_fixed_imgs = []
        for img in imgs:
            c = img.shape[2]
            fixed_img = img
            if c < max_c:
                h, w = img.shape[:2]
                temp_img = np.ones((h, w, max_c))
                temp_img[:, :, :c] = fixed_img
                fixed_img = temp_img
            channel_fixed_imgs.append(fixed_img.astype("float32"))
        imgout = channel_fixed_imgs[0]
        imgs = channel_fixed_imgs[1:]

        center_x = imgout.shape[1] // 2
        center_y = imgout.shape[0] // 2
        for img, op in zip(imgs, (op1, op2)):
            if img is not None and op is not None:
                h, w, c = img.shape
                if c == 4:
                    is_opaque = np.all(np.isclose(img[:, :, 3], [1.0]))
                else:
                    is_opaque = True

                # Center overlay
                x_offset = center_x - (w // 2)
                y_offset = center_y - (h // 2)

                img = cv2.addWeighted(
                    imgout[y_offset : y_offset + h, x_offset : x_offset + w],
                    1 - op,
                    img,
                    op,
                    0,
                )

                # If an image with native opacity is overlayed, the colors in the transparent areas
                # need to be modified by the alpha channel of the image being overlayed, or the
                # alpha channel will be incorrectly applied to the final image.
                if max_c == 4 and not is_opaque:
                    for channel in range(0, 3):
                        imgout[
                            y_offset : y_offset + h, x_offset : x_offset + w, channel
                        ] = img[:, :, 3] * img[:, :, channel] + imgout[
                            y_offset : y_offset + h, x_offset : x_offset + w, 3
                        ] * imgout[
                            y_offset : y_offset + h, x_offset : x_offset + w, channel
                        ] * (
                            1 - img[:, :, 3]
                        )
                else:
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


@NodeFactory.register("chainner:image:normalize_normal_map")
class NormalizeNode(NodeBase):
    """Normalize normal map"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = """Normalizes the given normal map.
            Only the R and G channels of the input image will be used."""
        self.inputs = [
            ImageInput("Normal Map"),
        ]
        self.outputs = [ImageOutput("Normal Map")]
        self.category = IMAGE_UTILITY
        self.name = "Normalize"
        self.icon = "MdOutlineAutoFixHigh"
        self.sub = "Normal Map"

    def run(self, img: np.ndarray) -> np.ndarray:
        """Takes a normal map and normalizes it"""

        logger.info(f"Normalizing image")
        assert img.ndim == 3, "The input image must be an RGB or RGBA image"

        # Convert BGR to XY
        x = normalize(img[:, :, 2]) * 2 - 1
        y = normalize(img[:, :, 1]) * 2 - 1

        x, y, z = normalize_normals(x, y)

        r_norm = (x + 1) * 0.5
        g_norm = (y + 1) * 0.5
        b_norm = z

        return cv2.merge((b_norm, g_norm, r_norm))


@NodeFactory.register("chainner:image:add_normals")
class NormalAdditionNode(NodeBase):
    """Add two normal maps together"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = """Add 2 normal maps together. Only the R and G
            channels of the input image will be used. The output normal map
            is guaranteed to be normalized."""
        self.inputs = [
            ImageInput("Normal Map 1"),
            SliderInput("Strength 1", 0, 100, 100),
            ImageInput("Normal Map 2"),
            SliderInput("Strength 2", 0, 100, 100),
        ]
        self.outputs = [ImageOutput("Normal Map")]
        self.category = IMAGE_UTILITY
        self.name = "Add Normals"
        self.icon = "MdAddCircleOutline"
        self.sub = "Normal Map"

    def run(
        self, n: np.ndarray, n_strength: int, m: np.ndarray, m_strength: int
    ) -> np.ndarray:
        """
        Takes 2 normal maps and adds them.

        The addition works by converting the normals into 2D slopes and then adding
        the slopes. The sum of the slopes is then converted back into normals.

        When adding 2 normal maps, the normals themselves are not added;
        Instead, the heightmaps that those normals represent are added.
        Conceptually, this entails converting the normals into slopes
        (the derivatives of the heightmap), integrating the slopes to get
        the heightmaps, adding the heightmaps, then performing the reverse
        on the added heightmaps. Practically, this is unnecessary, as adding
        the slopes together is equivalent to adding the heightmaps.
        """

        logger.info(f"Adding normal maps")
        assert (
            n.ndim == 3 and m.ndim == 3
        ), "The input images must be RGB or RGBA images"

        n_strength /= 100
        m_strength /= 100

        # Convert BGR to XY
        n_x = normalize(n[:, :, 2]) * 2 - 1
        n_y = normalize(n[:, :, 1]) * 2 - 1
        m_x = normalize(m[:, :, 2]) * 2 - 1
        m_y = normalize(m[:, :, 1]) * 2 - 1

        n_x, n_y, n_z = normalize_normals(n_x, n_y)
        m_x, m_y, m_z = normalize_normals(m_x, m_y)

        # Slopes aren't defined for z=0, so set to near-zero decimal
        n_z = np.maximum(n_z, 0.001, out=n_z)
        m_z = np.maximum(m_z, 0.001, out=m_z)

        # This works as follows:
        # 1. Use the normals n,m to calculate 3D planes (the slopes) centered at origin p_n,p_m.
        # 2. Calculate the Z values of those planes at a_xy=(1,0) and b_xy=(0,1).
        # 3. Add the Z values to together (weighted using their strength):
        #    a_z = p_n[a_xy] * n_strength + p_m[a_xy] * m_strength, same for b_xy.
        # 4. Define a=(1,0,a_z), b=(0,1,b_z).
        # 5. The final normal will be normalize(cross(a,b)).
        # This works out as:

        n_f = n_strength / n_z
        m_f = m_strength / m_z
        a_z = n_x * n_f + m_x * m_f
        b_z = n_y * n_f + m_y * m_f

        l_r = 1 / np.sqrt(np.square(a_z) + np.square(b_z) + 1)
        x = a_z * l_r
        y = b_z * l_r
        z = l_r

        r_norm = (x + 1) * 0.5
        g_norm = (y + 1) * 0.5
        b_norm = z

        return cv2.merge((b_norm, g_norm, r_norm))
