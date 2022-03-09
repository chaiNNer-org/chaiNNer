"""
Nodes that provide functionality for opencv image manipulation
"""

import math
import os
import sys

import cv2
import numpy as np
from sanic.log import logger

from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *


@NodeFactory.register("Image", "Load Image")
class ImReadNode(NodeBase):
    """OpenCV Imread node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Load image from file."
        self.inputs = [ImageFileInput()]
        self.outputs = [
            ImageOutput(),
            # IntegerOutput("Height"),
            # IntegerOutput("Width"),
            # IntegerOutput("Channels"),
        ]
        self.icon = "BsFillImageFill"
        self.sub = "Input & Output"

    def run(self, path: str) -> np.ndarray:
        """Reads an image from the specified path and return it as a numpy array"""

        logger.info(f"Reading image from path: {path}")
        try:
            img = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
        except:
            logger.warn(f"Error loading image, trying with imread.")
            try:
                img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
            except Exception as e:
                logger.error("Error loading image.")
                raise RuntimeError(
                    f'Error reading image image from path "{path}". Image may be corrupt.'
                )

        dtype_max = 1
        try:
            dtype_max = np.iinfo(img.dtype).max
        except:
            logger.info("img dtype is not an int")

        img = img.astype("float32") / dtype_max

        h, w = img.shape[:2]
        c = img.shape[2] if img.ndim > 2 else 1

        return img, h, w, c


@NodeFactory.register("Image", "Save Image")
class ImWriteNode(NodeBase):
    """OpenCV Imwrite node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Save image to file at a specified directory."
        self.inputs = [
            ImageInput(),
            DirectoryInput(),
            TextInput("Image Name"),
            ImageExtensionDropdown(),
        ]
        self.outputs = []
        self.icon = "BsImage"
        self.sub = "Input & Output"

    def run(
        self, img: np.ndarray, directory: str, filename: str, extension: str
    ) -> bool:
        """Write an image to the specified path and return write status"""
        fullFile = f"{filename}.{extension}"
        fullPath = os.path.join(directory, fullFile)
        logger.info(f"Writing image to path: {fullPath}")

        # Put image back in int range
        img = (np.clip(img, 0, 1) * 255).round().astype("uint8")

        status = cv2.imwrite(fullPath, img)

        return status


@NodeFactory.register("Image", "Preview Image")
class ImShowNode(NodeBase):
    """OpenCV Imshow node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Show image preview in a new window."
        self.inputs = [ImageInput()]
        self.outputs = []
        self.icon = "BsEyeFill"
        self.sub = "Input & Output"

    def checkerboard(self, h, w):
        square_size = 8
        new_h = (h // square_size) + 1
        new_w = (w // square_size) + 1
        # Black and white checkerboard
        # from https://stackoverflow.com/questions/2169478/how-to-make-a-checkerboard-in-numpy
        checkerboard = (np.indices((new_h, new_w)).sum(axis=0) % 2).astype("uint8")
        # Modify to a mixed grayish color
        checkerboard = ((checkerboard * 127) + 128) // 2
        # Resize to full size
        checkerboard = cv2.resize(
            checkerboard,
            (new_w * square_size, new_h * square_size),
            interpolation=cv2.INTER_NEAREST,
        )
        # Crop to fit original resolution
        checkerboard = checkerboard[:h, :w]
        return checkerboard.astype("float32") / 255

    def run(self, img: np.ndarray) -> bool:
        """Show image"""
        try:
            # Theoretically this isn't necessary, but just in case
            dtype_max = 1
            try:
                dtype_max = np.iinfo(img.dtype).max
            except:
                logger.debug("img dtype is not int")

            show_img = img.astype("float32") / dtype_max
            # logger.info(dtype_max)
            if img.ndim > 2 and img.shape[2] == 4:
                h, w, _ = img.shape
                checkerboard = self.checkerboard(h, w)
                checkerboard = cv2.cvtColor(checkerboard, cv2.COLOR_GRAY2BGR)
                alpha = cv2.cvtColor(show_img[:, :, 3], cv2.COLOR_GRAY2BGR)

                foreground = cv2.multiply(alpha, show_img[:, :, :3])
                background = cv2.multiply(1.0 - alpha, checkerboard)
                show_img = cv2.add(foreground, background)

            h, w = show_img.shape[:2]
            x = int(0.85 * int(os.environ["resolutionX"]))
            y = int(0.85 * int(os.environ["resolutionY"]))
            if h > y and w > x:
                ratio = min(y / h, x / w)
                new_h = int(ratio * h)
                new_w = int(ratio * w)
                show_img = cv2.resize(
                    show_img, (new_w, new_h), interpolation=cv2.INTER_AREA
                )
            elif h > y:
                ratio = y / h
                new_h = y
                new_w = int(ratio * w)
                show_img = cv2.resize(
                    show_img, (new_w, new_h), interpolation=cv2.INTER_AREA
                )
            elif w > x:
                ratio = x / w
                new_h = int(ratio * h)
                new_w = x
                show_img = cv2.resize(
                    show_img, (new_w, new_h), interpolation=cv2.INTER_AREA
                )
            cv2.imshow("Image Preview", show_img)
            cv2.waitKey(0)
        except Exception as e:
            logger.fatal(e)
            logger.fatal("Imshow had a critical error")


@NodeFactory.register("Image (Utility)", "Resize (Factor)")
class ImResizeByFactorNode(NodeBase):
    """OpenCV resize node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = (
            "Resize an image by a scale factor (e.g. 2 for 200% or 0.5 for 50%)."
        )
        self.inputs = [
            ImageInput(),
            NumberInput("Scale Factor", default=1.0, step=0.5),
            InterpolationInput(),
        ]
        self.outputs = [ImageOutput()]
        self.icon = "MdOutlinePhotoSizeSelectLarge"
        self.sub = "Resizing & Reshaping"

    def run(self, img: np.ndarray, scale: float, interpolation: int) -> np.ndarray:
        """Takes an image and resizes it"""

        logger.info(f"Resizing image by {scale} via {interpolation}")
        result = cv2.resize(
            img,
            None,
            fx=float(scale),
            fy=float(scale),
            interpolation=int(interpolation),
        )

        return result


@NodeFactory.register("Image (Utility)", "Resize (Resolution)")
class ImResizeToResolutionNode(NodeBase):
    """OpenCV resize node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Resize an image to an exact resolution."
        self.inputs = [
            ImageInput(),
            IntegerInput("Width"),
            IntegerInput("Height"),
            InterpolationInput(),
        ]
        self.outputs = [ImageOutput()]
        self.icon = "MdOutlinePhotoSizeSelectLarge"
        self.sub = "Resizing & Reshaping"

    def run(
        self, img: np.ndarray, width: int, height: int, interpolation: int
    ) -> np.ndarray:
        """Takes an image and resizes it"""

        logger.info(f"Resizing image to {width}x{height} via {interpolation}")
        result = cv2.resize(
            img, (int(width), int(height)), interpolation=int(interpolation)
        )

        return result


@NodeFactory.register("Image (Utility)", "Change Colorspace")
class ColorConvertNode(NodeBase):
    """OpenCV color conversion node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Convert the colorspace of an image to a different one. Also can convert to different channel-spaces."
        self.inputs = [
            ImageInput(),
            ColorModeInput(),
        ]
        self.outputs = [ImageOutput()]
        self.icon = "MdColorLens"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray, color_mode: int) -> np.ndarray:
        """Takes an image and changes the color mode it"""

        result = cv2.cvtColor(img, int(color_mode))

        return result


@NodeFactory.register("Image (Utility)", "Create Border")
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
        self.icon = "BsBorderOuter"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray, border_type: int, amount: int) -> np.ndarray:
        """Takes an image and applies a border to it"""

        result = cv2.copyMakeBorder(
            img,
            int(amount),
            int(amount),
            int(amount),
            int(amount),
            int(border_type),
            None,
            value=0,
        )

        return result


@NodeFactory.register("Image (Effect)", "Threshold")
class ThresholdNode(NodeBase):
    """OpenCV Threshold node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Perform a threshold on an image."
        self.inputs = [
            ImageInput(),
            SliderInput("Threshold", 0, 100, 50),
            SliderInput("Maximum Value", 0, 100, 100),
            ThresholdInput(),
        ]
        self.outputs = [ImageOutput()]
        self.icon = "MdShowChart"
        self.sub = "Miscellaneous"

    def run(
        self, img: np.ndarray, thresh: int, maxval: int, thresh_type: int
    ) -> np.ndarray:
        """Takes an image and applies a threshold to it"""

        dtype_max = 1
        try:
            dtype_max = np.iinfo(img.dtype).max
        except:
            logger.debug("img dtype is not int")

        if (
            thresh_type == cv2.THRESH_OTSU or thresh_type == cv2.THRESH_TRIANGLE
        ) and img.ndim != 2:
            raise RuntimeError(
                "Image must be grayscale (single channel) to apply a threshold"
            )

        logger.info(f"thresh {thresh}, maxval {maxval}, type {thresh_type}")

        real_thresh = int(thresh) / 100 * dtype_max
        real_maxval = int(maxval) / 100 * dtype_max

        logger.info(f"real_thresh {real_thresh}, real_maxval {real_maxval}")

        _, result = cv2.threshold(img, real_thresh, real_maxval, int(thresh_type))

        return result


@NodeFactory.register("Image (Effect)", "Threshold (Adaptive)")
class AdaptiveThresholdNode(NodeBase):
    """OpenCV Adaptive Threshold node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Perform an adaptive threshold on an image."
        self.inputs = [
            ImageInput(),
            SliderInput("Maximum Value", 0, 100, 100),
            AdaptiveMethodInput(),
            AdaptiveThresholdInput(),
            OddIntegerInput("Block Size"),
            IntegerInput("Mean Subtraction"),
        ]
        self.outputs = [ImageOutput()]
        self.icon = "MdAutoGraph"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        maxval: int,
        adaptive_method: int,
        thresh_type: int,
        block_size: int,
        c: int,
    ) -> np.ndarray:
        """Takes an image and applies an adaptive threshold to it"""

        dtype_max = 1
        try:
            dtype_max = np.iinfo(img.dtype).max
        except:
            logger.debug("img dtype is not int")

        assert (
            img.ndim == 2
        ), "Image must be grayscale (single channel) to apply an adaptive threshold"

        assert block_size % 2 == 1, "Block size must be an odd number"

        real_maxval = int(maxval) / 100 * dtype_max

        result = cv2.adaptiveThreshold(
            img,
            real_maxval,
            int(adaptive_method),
            int(thresh_type),
            int(block_size),
            int(c),
        )

        return result


@NodeFactory.register("Image (Utility)", "Stack Images")
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
        self.icon = "CgMergeVertical"
        self.sub = "Miscellaneous"

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
            if img is not None:
                h, w = img.shape[:2]
                c = img.shape[2] or 1
                max_h = max(h, max_h)
                max_w = max(w, max_w)
                max_c = max(c, max_c)
                imgs.append(img)

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


@NodeFactory.register("Image (Effect)", "Brightness & Contrast")
class BrightnessAndContrastNode(NodeBase):
    """OpenCV Brightness Node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Adjust the brightness and contrast of an image."
        self.inputs = [
            ImageInput(),
            SliderInput("Brightness", -100, 100, 0),
            SliderInput("Contrast", 0, 200, 100),
        ]
        self.outputs = [ImageOutput()]
        self.icon = "ImBrightnessContrast"
        self.sub = "Adjustment"

    def run(self, img: np.ndarray, b_amount: int, c_amount: int) -> np.ndarray:
        """Adjusts the brightness and contrast of an image"""

        dtype_max = 1
        try:
            dtype_max = np.iinfo(img.dtype).max
        except:
            logger.debug("img dtype is not int")
        f_img = img.astype("float32") / dtype_max
        b_amount = int(b_amount) / 100
        c_amount = int(c_amount) / 100

        f_img = (f_img * c_amount) + b_amount
        img = np.clip((f_img * dtype_max), 0, dtype_max).astype(img.dtype)

        return img


@NodeFactory.register("Image (Effect)", "Blur")
class BlurNode(NodeBase):
    """OpenCV Blur Node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Blur an image"
        self.inputs = [
            ImageInput(),
            IntegerInput("Amount X"),
            IntegerInput("Amount Y"),
        ]  # , IntegerInput("Sigma")]#,BlurInput()]
        self.outputs = [ImageOutput()]
        self.icon = "MdBlurOn"
        self.sub = "Adjustment"

    def run(
        self,
        img: np.ndarray,
        amountX: int,
        amountY: int,
        # sigma: int,
    ) -> np.ndarray:
        """Adjusts the blur of an image"""
        # ksize=(math.floor(int(amountX)/2)*2+1,math.floor(int(amountY)/2)*2+1)
        # img=cv2.GaussianBlur(img,ksize,int(sigma))
        ksize = (int(amountX), int(amountY))
        for __i in range(16):
            img = cv2.blur(img, ksize)

        return img


@NodeFactory.register("Image (Effect)", "Shift")
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
        self.icon = "BsGraphDown"
        self.sub = "Adjustment"

    def run(
        self,
        img: np.ndarray,
        amountX: int,
        amountY: int,
    ) -> np.ndarray:
        """Adjusts the position of an image"""
        num_rows, num_cols = img.shape[:2]
        translation_matrix = np.float32([[1, 0, amountX], [0, 1, amountY]])
        img = cv2.warpAffine(img, translation_matrix, (num_cols, num_rows))
        return img


@NodeFactory.register("Image (Utility)", "Split Channels")
class ChannelSplitRGBANode(NodeBase):
    """NumPy  Splitter node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Split numpy image channels into separate channels. Typically used for splitting off an alpha (transparency) layer."
        self.inputs = [ImageInput()]
        self.outputs = [
            ImageOutput("Blue Channel"),
            ImageOutput("Green Channel"),
            ImageOutput("Red Channel"),
            ImageOutput("Alpha Channel"),
        ]

        self.icon = "MdCallSplit"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray) -> np.ndarray:
        """Split a multi-channel image into separate channels"""
        c = 1
        dtype_max = 1
        try:
            dtype_max = np.iinfo(img.dtype).max
        except:
            logger.debug("img dtype is not int")

        if img.ndim > 2:
            c = img.shape[2]
            safe_out = np.ones_like(img[:, :, 0]) * dtype_max
        else:
            safe_out = np.ones_like(img) * dtype_max

        out = []
        for i in range(c):
            out.append(img[:, :, i])
        for i in range(4 - c):
            out.append(safe_out)

        return out


@NodeFactory.register("Image (Utility)", "Merge Channels")
class ChannelMergeRGBANode(NodeBase):
    """NumPy Merger node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Merge numpy channels together into a <= 4 channel image. Typically used for combining an image with an alpha layer."
        self.inputs = [
            ImageInput("Channel(s) A"),
            ImageInput("Channel(s) B", optional=True),
            ImageInput("Channel(s) C", optional=True),
            ImageInput("Channel(s) D", optional=True),
        ]
        self.outputs = [ImageOutput()]

        self.icon = "MdCallMerge"
        self.sub = "Miscellaneous"

    def run(
        self,
        im1: np.ndarray,
        im2: np.ndarray = None,
        im3: np.ndarray = None,
        im4: np.ndarray = None,
    ) -> np.ndarray:
        """Combine separate channels into a multi-chanel image"""

        start_shape = im1.shape[:2]

        for im in im2, im3, im4:
            if im is not None:
                assert (
                    im.shape[:2] == start_shape
                ), "All images to be merged must be the same resolution"

        imgs = []
        for img in im1, im2, im3, im4:
            if img is not None:
                imgs.append(img)

        for idx, img in enumerate(imgs):
            if img.ndim == 2:
                imgs[idx] = np.expand_dims(img, axis=2)

        img = np.concatenate(imgs, axis=2)

        # ensure output is safe number of channels
        if img.ndim > 2:
            h, w, c = img.shape
            if c == 2:
                b, g = cv2.split(img)
                img = cv2.merge((b, g, g))
            if c > 4:
                img = img[:, :, :4]

        return img


@NodeFactory.register("Image (Utility)", "Crop (Offsets)")
class CropNode(NodeBase):
    """NumPy Crop node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Crop an image based on offset from the top-left corner, and the wanted resolution."
        self.inputs = [
            ImageInput(),
            IntegerInput("Top Offset"),
            IntegerInput("Left Offset"),
            IntegerInput("Height"),
            IntegerInput("Width"),
        ]
        self.outputs = [ImageOutput()]

        self.icon = "MdCrop"
        self.sub = "Resizing & Reshaping"

    def run(
        self, img: np.ndarray, top: int, left: int, height: int, width: int
    ) -> np.ndarray:
        """Crop an image"""

        h, w = img.shape[:2]

        top = int(top)
        left = int(left)
        height = int(height)
        width = int(width)

        assert top < h, "Cropped area would result in image with no height"
        assert left < w, "Cropped area would result in image with no width"

        result = img[top : top + height, left : left + width]

        return result


@NodeFactory.register("Image (Utility)", "Crop (Border)")
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
            IntegerInput("Amount"),
        ]
        self.outputs = [ImageOutput()]

        self.icon = "MdCrop"
        self.sub = "Resizing & Reshaping"

    def run(self, img: np.ndarray, amount: int) -> np.ndarray:
        """Crop an image"""

        h, w = img.shape[:2]

        amount = int(amount)

        assert 2 * amount < h, "Cropped area would result in image with no height"
        assert 2 * amount < w, "Cropped area would result in image with no width"

        result = img[amount : h - amount, amount : w - amount]

        return result


@NodeFactory.register("Image (Utility)", "Crop (Edges)")
class EdgeCropNode(NodeBase):
    """NumPy Edge Crop node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Crop an image using separate amounts from each edge."
        self.inputs = [
            ImageInput(),
            IntegerInput("Top"),
            IntegerInput("Left"),
            IntegerInput("Right"),
            IntegerInput("Bottom"),
        ]
        self.outputs = [ImageOutput()]

        self.icon = "MdCrop"
        self.sub = "Resizing & Reshaping"

    def run(
        self, img: np.ndarray, top: str, left: str, right: str, bottom: str
    ) -> np.ndarray:
        """Crop an image"""

        h, w = img.shape[:2]

        top, left, right, bottom = [int(x) for x in [top, left, right, bottom]]

        assert top + bottom < h, "Cropped area would result in image with no height"
        assert left + right < w, "Cropped area would result in image with no width"

        result = img[top : h - bottom, left : w - right]

        return result
