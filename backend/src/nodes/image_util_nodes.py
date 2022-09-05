from __future__ import annotations

import math
from typing import List, Tuple

import cv2
import numpy as np

from .categories import ImageUtilityCategory
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.image_utils import (
    as_2d_grayscale,
    blend_images,
    calculate_ssim,
    shift,
    FlipAxis,
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
            ImageInput(
                "Base Layer",
                image_type=expression.Image(channels=[1, 3, 4]),
            ),
            ImageInput(
                "Overlay Layer",
                image_type=expression.Image(channels=[1, 3, 4]),
            ),
            BlendModeDropdown(),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="max(Input0.width, Input1.width)",
                    height="max(Input0.height, Input1.height)",
                    channels="max(Input0.channels, Input1.channels)",
                )
            ),
        ]
        self.category = ImageUtilityCategory
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
        o_h, o_w, _ = get_h_w_c(ov)
        max_h = max(b_h, o_h)
        max_w = max(b_w, o_w)

        if (b_w, b_h) == (o_w, o_h):
            # we don't have to do any size adjustments
            result = blend_images(ov, base, blend_mode)
        else:
            # Pad base image with transparency if necessary to match size with overlay
            top = bottom = left = right = 0
            if b_h < max_h:
                top = (max_h - b_h) // 2
                bottom = max_h - b_h - top
            if b_w < max_w:
                left = (max_w - b_w) // 2
                right = max_w - b_w - left
            if any((top, bottom, left, right)):
                # copyMakeBorder will create black border if base not converted to RGBA first
                base = convert_to_BGRA(base, b_c)
                base = cv2.copyMakeBorder(
                    base, top, bottom, left, right, cv2.BORDER_CONSTANT, value=0
                )
            else:  # Make sure cached image not being worked on regardless
                base = base.copy()

            # Center overlay
            center_x = base.shape[1] // 2
            center_y = base.shape[0] // 2
            x_offset = center_x - (o_w // 2)
            y_offset = center_y - (o_h // 2)

            blended_img = blend_images(
                ov,
                base[y_offset : y_offset + o_h, x_offset : x_offset + o_w],
                blend_mode,
            )

            result = base  # Just so the names make sense
            result_c = get_h_w_c(result)[2]
            blend_c = get_h_w_c(blended_img)[2]

            # Have to ensure blend and result have same shape
            if result_c < blend_c:
                if blend_c == 4:
                    result = convert_to_BGRA(result, result_c)
                else:
                    result = as_2d_grayscale(result)
                    result = np.dstack((result, result, result))
            result[y_offset : y_offset + o_h, x_offset : x_offset + o_w] = blended_img

        result = np.clip(result, 0, 1)

        return result


@NodeFactory.register("chainner:image:stack")
class StackNode(NodeBase):
    """OpenCV concatenate (h/v) Node"""

    def __init__(self):
        super().__init__()
        self.description = "Concatenate multiple images horizontally or vertically."
        self.inputs = [
            ImageInput("Image A"),
            ImageInput("Image B").make_optional(),
            ImageInput("Image C").make_optional(),
            ImageInput("Image D").make_optional(),
            StackOrientationDropdown(),
        ]
        self.outputs = [
            ImageOutput(
                image_type="""
                def getWidth(img: Image | null) = match img { null => 0, _ as i => i.width };
                def getHeight(img: Image | null) = match img { null => 0, _ as i => i.height };
                def getChannels(img: Image | null) {
                    match img {
                        null => 0,
                        _ as i => match i.channels { 1 => 3, _ as c => c }
                    }
                }

                let maxWidth = max(Input0.width, getWidth(Input1), getWidth(Input2), getWidth(Input3));
                let maxHeight = max(Input0.height, getHeight(Input1), getHeight(Input2), getHeight(Input3));
                let maxChannels = max(Input0.channels, getChannels(Input1), getChannels(Input2), getChannels(Input3));

                def getAdjustedWidth(img: Image | null) {
                    match img {
                        null => 0,
                        _ as i => uint & round(divide(multiply(i.width, maxHeight), i.height))
                    }
                }
                def getAdjustedHeight(img: Image | null) {
                    match img {
                        null => 0,
                        _ as i => uint & round(divide(multiply(i.height, maxWidth), i.width))
                    }
                }

                let widthSum = add(getAdjustedWidth(Input0), getAdjustedWidth(Input1), getAdjustedWidth(Input2), getAdjustedWidth(Input3));
                let heightSum = add(getAdjustedHeight(Input0), getAdjustedHeight(Input1), getAdjustedHeight(Input2), getAdjustedHeight(Input3));

                Image {
                    width: match Input4 {
                        Orientation::Vertical => maxWidth,
                        Orientation::Horizontal => widthSum
                    },
                    height: match Input4 {
                        Orientation::Vertical => heightSum,
                        Orientation::Horizontal => maxHeight
                    },
                    channels: maxChannels
                }
                """
            )
        ]
        self.category = ImageUtilityCategory
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
        img = im1
        imgs = []
        max_h, max_w, max_c = 0, 0, 1
        for img in im1, im2, im3, im4:
            if img is not None:
                h, w, c = get_h_w_c(img)
                if c == 1:
                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
                    c = 3
                max_h = max(h, max_h)
                max_w = max(w, max_w)
                max_c = max(c, max_c)
                imgs.append(img)

        fixed_imgs: List[np.ndarray] = []
        for img in imgs:
            h, w, c = get_h_w_c(img)

            fixed_img = img
            # Fix images so they resize proportionally to the max image
            if orientation == "horizontal":
                if h < max_h:
                    fixed_img = cv2.resize(
                        img,
                        (round(w * max_h / h), max_h),
                        interpolation=cv2.INTER_NEAREST,
                    )
            elif orientation == "vertical":
                if w < max_w:
                    fixed_img = cv2.resize(
                        img,
                        (max_w, round(h * max_w / w)),
                        interpolation=cv2.INTER_NEAREST,
                    )
            else:
                assert False, f"Invalid orientation '{orientation}'"

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
        else:
            assert False, f"Invalid orientation '{orientation}'"

        return img


@NodeFactory.register("chainner:image:caption")
class CaptionNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Add a caption to the bottom of an image."
        self.inputs = [
            ImageInput(),
            TextInput("Caption"),
            NumberInput("Caption Size", minimum=20, default=42, unit="px"),
            CaptionPositionInput(),
        ]
        self.outputs = [
            ImageOutput(
                image_type="""
                // this value is defined by `add_caption`
                let captionHeight = Input2;
                Image {
                    width: Input0.width,
                    height: add(Input0.height, captionHeight),
                    channels: Input0.channels,
                }
                """
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Add Caption"
        self.icon = "MdVideoLabel"
        self.sub = "Compositing"

    def run(self, img: np.ndarray, caption: str, size: int, position: str) -> np.ndarray:
        """Add caption an image"""

        return add_caption(img, caption, size, position)


@NodeFactory.register("chainner:image:change_colorspace")
class ColorConvertNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Convert the colorspace of an image to a different one. "
            "Also can convert to different channel-spaces."
        )
        self.inputs = [
            ImageInput(image_type=expression.Image(channels="Input1.inputChannels")),
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
        self.category = ImageUtilityCategory
        self.name = "Change Colorspace"
        self.icon = "MdColorLens"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray, color_mode: int) -> np.ndarray:
        """Takes an image and changes the color mode it"""

        def reverse3(image: np.ndarray) -> np.ndarray:
            c = get_h_w_c(image)[2]
            assert c == 3, "Expected a 3-channel image"
            return np.stack([image[:, :, 2], image[:, :, 1], image[:, :, 0]], axis=2)

        # preprocessing
        if color_mode in (cv2.COLOR_HSV2BGR, cv2.COLOR_YUV2BGR):
            img = reverse3(img)

        if color_mode == cv2.COLOR_HSV2BGR:
            img[:, :, 0] *= 360

        # color conversion
        result = cv2.cvtColor(img, color_mode)

        # postprocessing
        if color_mode == cv2.COLOR_BGR2HSV:
            result[:, :, 0] /= 360

        if color_mode in (cv2.COLOR_BGR2HSV, cv2.COLOR_BGR2YUV):
            result = reverse3(result)

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
                    width="add(Input0.width, multiply(Input2, 2))",
                    height="add(Input0.height, multiply(Input2, 2))",
                )
            )
        ]
        self.category = ImageUtilityCategory
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
        self.category = ImageUtilityCategory
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
                precision=1,
                controls_step=45,
                slider_step=1,
                unit="°",
            ),
            RotateInterpolationInput(),
            RotateExpansionInput(),
            FillColorDropdown(),
        ]
        self.outputs = [
            ImageOutput(
                image_type="""
                // This is a near verbatim copy of PIL's rotate code
                // to get the size of the rotated image.
                // https://pillow.readthedocs.io/en/stable/_modules/PIL/Image.html#Image.rotate
                struct Point { x: number, y: number }

                let rot_center = Point {
                    x: divide(Input0.width, 2),
                    y: divide(Input0.height, 2),
                };

                let angle = negate(degToRad(Input1));
                let m0 = cos(angle);
                let m1 = sin(angle);
                let m2 = add(rot_center.x, multiply(m0, negate(rot_center.x)), multiply(m1, negate(rot_center.y)));
                let m3 = negate(sin(angle));
                let m4 = cos(angle);
                let m5 = add(rot_center.y, multiply(m3, negate(rot_center.x)), multiply(m4, negate(rot_center.y)));

                def transform(x: number, y: number) {
                    Point {
                        x: add(multiply(m0, x), multiply(m1, y), m2),
                        y: add(multiply(m3, x), multiply(m4, y), m5),
                    }
                }

                let p0 = transform(0, 0);
                let p1 = transform(Input0.width, 0);
                let p2 = transform(Input0.width, Input0.height);
                let p3 = transform(0, Input0.height);

                let expandWidth = uint & subtract(
                    ceil(max(p0.x, p1.x, p2.x, p3.x)),
                    floor(min(p0.x, p1.x, p2.x, p3.x))
                );
                let expandHeight = uint & subtract(
                    ceil(max(p0.y, p1.y, p2.y, p3.y)),
                    floor(min(p0.y, p1.y, p2.y, p3.y))
                );

                Image {
                    width: match Input3 {
                        RotateSizeChange::Crop => Input0.width,
                        _ => expandWidth
                    },
                    height: match Input3 {
                        RotateSizeChange::Crop => Input0.height,
                        _ => expandHeight
                    },
                    channels: match Input4 { FillColor::Transparent => 4, _ => Input0.channels }
                }
                """
            )
        ]
        self.category = ImageUtilityCategory
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
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageUtilityCategory
        self.name = "Flip"
        self.icon = "MdFlip"
        self.sub = "Modification"

    def run(self, img: np.ndarray, axis: int) -> np.ndarray:
        if axis == FlipAxis.NONE:
            return img
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
            NumberOutput("MSE", output_type="0..1"),
            NumberOutput("PSNR", output_type="0.."),
            NumberOutput("SSIM", output_type="0..1"),
        ]
        self.category = ImageUtilityCategory
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


@NodeFactory.register("chainner:image:canny_edge_detection")
class CannyEdgeDetectionNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Detect the edges of the input image and output as black and white image."
        )
        self.inputs = [
            ImageInput(),
            NumberInput("Lower Threshold", minimum=0, default=100),
            NumberInput("Upper Threshold", minimum=0, default=300),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageUtilityCategory
        self.name = "Canny Edge Detection"
        self.icon = "MdAutoFixHigh"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        t_lower: int,
        t_upper: int,
    ) -> np.ndarray:

        img = (img * 255).astype(np.uint8)

        edges = cv2.Canny(img, t_lower, t_upper)

        return edges
