from __future__ import annotations

from math import ceil

import cv2
import numpy as np

from sanic.log import logger

from .categories import IMAGE_FILTER
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.color_transfer import color_transfer
from .utils.image_utils import normalize_normals
from .utils.pil_utils import *
from .utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:blur")
class BlurNode(NodeBase):
    """OpenCV Blur Node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Apply box/average blur to an image"
        self.inputs = [
            ImageInput(),
            NumberInput("Amount X", step=0.1, controls_step=1),
            NumberInput("Amount Y", step=0.1, controls_step=1),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_FILTER
        self.name = "Box Blur"
        self.icon = "MdBlurOn"
        self.sub = "Blur/Sharpen"

    def run(
        self,
        img: np.ndarray,
        amount_x: float,
        amount_y: float,
    ) -> np.ndarray:
        """Adjusts the blur of an image"""

        if amount_x == 0 and amount_y == 0:
            return img

        # Create kernel of dims h * w, rounded up to the closest odd integer
        kernel = np.ones(
            (ceil(amount_y) * 2 + 1, ceil(amount_x) * 2 + 1), np.float32
        ) / ((2 * amount_y + 1) * (2 * amount_x + 1))

        # Modify edges of kernel by fractional amount if kernel size (2r+1) is not odd integer
        x_d = amount_x % 1
        y_d = amount_y % 1
        if y_d != 0:
            kernel[(0, -1), :] *= y_d
        if x_d != 0:
            kernel[:, (0, -1)] *= x_d

        # Linear filter with reflected padding
        return np.clip(
            cv2.filter2D(img, -1, kernel, borderType=cv2.BORDER_REFLECT_101), 0, 1
        )


@NodeFactory.register("chainner:image:gaussian_blur")
class GaussianBlurNode(NodeBase):
    """OpenCV Gaussian Blur Node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Apply Gaussian Blur to an image"
        self.inputs = [
            ImageInput(),
            NumberInput("Amount X", step=0.1, controls_step=1),
            NumberInput("Amount Y", step=0.1, controls_step=1),
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
        """Adjusts the blur of an image"""

        if amount_x == 0 and amount_y == 0:
            return img
        else:
            return np.clip(
                cv2.GaussianBlur(img, (0, 0), sigmaX=amount_x, sigmaY=amount_y), 0, 1
            )


@NodeFactory.register("chainner:image:median_blur")
class MedianBlurNode(NodeBase):
    """Median Blur Node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Apply median blur to an image"
        self.inputs = [
            ImageInput(),
            NumberInput("Amount"),
        ]
        self.outputs = [ImageOutput()]
        self.category = IMAGE_FILTER
        self.name = "Median Blur"
        self.icon = "MdBlurOn"
        self.sub = "Blur/Sharpen"

    def run(
        self,
        img: np.ndarray,
        amount: int,
    ):
        """Adjusts the blur of an image"""

        if amount == 0:
            return img
        else:
            if amount < 3:
                blurred = cv2.medianBlur(img, 2 * amount + 1)
            else:  # cv2 requires uint8 for kernel size (2r+1) > 5
                img = (img * 255).astype("uint8")
                blurred = cv2.medianBlur(img, 2 * amount + 1).astype("float32") / 255

            return np.clip(blurred, 0, 1)


@NodeFactory.register("chainner:image:sharpen")
class SharpenNode(NodeBase):
    """OpenCV Sharpen Node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Apply sharpening to an image"
        self.inputs = [
            ImageInput(),
            NumberInput("Amount"),
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

        return np.clip(img, 0, 1)


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
            NumberInput(
                "Reference Image Scale Factor",
                step=0.0001,
                controls_step=12.5,
                maximum=100.0,
                default=12.5,
                unit="%",
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

        if scale_factor != 100.0:
            # Make sure reference image dims are not resized to 0
            h, w, _ = get_h_w_c(ref_img)
            out_dims = (
                max(ceil(w * (scale_factor / 100)), 1),
                max(ceil(h * (scale_factor / 100)), 1),
            )

            ref_img = cv2.resize(
                ref_img,
                out_dims,
                interpolation=cv2.INTER_AREA,
            )

        input_h, input_w, input_c = get_h_w_c(input_img)
        ref_h, ref_w, ref_c = get_h_w_c(ref_img)

        assert (
            ref_w < input_w and ref_h < input_h
        ), "Image must be larger than Reference Image"
        assert input_c in (3, 4), "The input image must be an RGB or RGBA image"
        assert ref_c in (3, 4), "The reference image must be an RGB or RGBA image"

        # adjust channels
        alpha = None
        if input_c > ref_c:
            alpha = input_img[:, :, 3:4]
            input_img = input_img[:, :, :ref_c]
        elif ref_c > input_c:
            ref_img = ref_img[:, :, :input_c]

        # Find the diff of both images

        # Downscale the input image
        downscaled_input = cv2.resize(
            input_img,
            (ref_w, ref_h),
            interpolation=cv2.INTER_AREA,
        )

        # Get difference between the reference image and downscaled input
        downscaled_diff = ref_img - downscaled_input  # type: ignore

        # Upsample the difference
        diff = cv2.resize(
            downscaled_diff,
            (input_w, input_h),
            interpolation=cv2.INTER_CUBIC,
        )

        result = input_img + diff

        # add alpha back in
        if alpha is not None:
            result = np.concatenate([result, alpha], axis=2)

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
                "Colorspace",
                [
                    {"option": "L*a*b*", "value": "L*a*b*"},
                    {"option": "RGB", "value": "RGB"},
                ],
                input_type="str",
            ),
            DropDownInput(
                "Overflow Method",
                [
                    {"option": "Clip", "value": 1},
                    {"option": "Scale", "value": 0},
                ],
                input_type="str",
            ),
            DropDownInput(
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
        overflow_method: int = 1,
        reciprocal_scale: int = 1,
    ) -> np.ndarray:
        """
        Transfers the color distribution from source image to target image.
        """

        _, _, img_c = get_h_w_c(img)
        _, _, ref_c = get_h_w_c(ref_img)

        assert ref_c >= 3, "Reference image should be RGB or RGBA"

        # Make sure target has at least 3 channels
        if img_c == 1:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

        # Preserve alpha
        alpha = None
        if img_c == 4:
            alpha = img[:, :, 3]

        transfer = color_transfer(
            img, ref_img, colorspace, overflow_method, reciprocal_scale
        )

        if alpha is not None:
            transfer = np.dstack((transfer, alpha))

        return transfer


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
        self.category = IMAGE_FILTER
        self.name = "Normalize Normal Map"
        self.icon = "MdOutlineAutoFixHigh"
        self.sub = "Normal Map"

    def run(self, img: np.ndarray) -> np.ndarray:
        """Takes a normal map and normalizes it"""

        logger.info(f"Normalizing image")
        assert img.ndim == 3, "The input image must be an RGB or RGBA image"

        # Convert BGR to XY
        x = img[:, :, 2] * 2 - 1
        y = img[:, :, 1] * 2 - 1

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
            SliderInput("Strength 1", maximum=100, default=100),
            ImageInput("Normal Map 2"),
            SliderInput("Strength 2", maximum=100, default=100),
        ]
        self.outputs = [ImageOutput("Normal Map")]
        self.category = IMAGE_FILTER
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

        n_norm_strength = n_strength / 100
        m_norm_strength = m_strength / 100

        # Convert BGR to XY
        n_x = n[:, :, 2] * 2 - 1
        n_y = n[:, :, 1] * 2 - 1
        m_x = m[:, :, 2] * 2 - 1
        m_y = m[:, :, 1] * 2 - 1

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

        n_f = n_norm_strength / n_z
        m_f = m_norm_strength / m_z
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
