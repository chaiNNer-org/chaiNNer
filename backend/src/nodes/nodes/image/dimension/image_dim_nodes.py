from __future__ import annotations

from typing import Tuple

import numpy as np
from sanic.log import logger

from ....categories import ImageDimensionCategory
from ....node_base import NodeBase
from ....node_factory import NodeFactory
from ....properties.inputs import *
from ....properties.outputs import *
from ....utils.fill_alpha import *
from ....utils.tile_util import tile_image
from ....utils.pil_utils import *
from ....utils.utils import get_h_w_c, resize_to_side_conditional


@NodeFactory.register("chainner:image:resize_factor")
class ImResizeByFactorNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Resize an image by a percent scale factor. "
            "Auto uses box for downsampling and lanczos for upsampling."
        )
        self.inputs = [
            ImageInput(),
            NumberInput(
                "Scale Factor",
                precision=4,
                controls_step=25.0,
                default=100.0,
                unit="%",
            ),
            InterpolationInput(),
        ]
        self.category = ImageDimensionCategory
        self.name = "Resize (Factor)"
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="max(1, int & round(Input0.width * Input1 / 100))",
                    height="max(1, int & round(Input0.height * Input1 / 100))",
                    channels_as="Input0",
                )
            )
        ]
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


@NodeFactory.register("chainner:image:resize_to_side")
class ImResizeToSide(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Resize an image to a given side length while keeping aspect ratio. "
            "Auto uses box for downsampling and lanczos for upsampling."
        )
        self.inputs = [
            ImageInput(),
            NumberInput(
                "Size Target",
                default=2160,
                minimum=1,
                unit="px",
            ),
            ResizeToSideInput(),
            InterpolationInput(),
            ResizeCondition(),
        ]
        self.category = ImageDimensionCategory
        self.name = "Resize To Side"
        self.outputs = [
            ImageOutput(
                image_type="""
                struct Size { width: uint, height: uint }

                let w = Input0.width;
                let h = Input0.height;
                let target = Input1;
                let side = Input2;
                let condition = Input4;

                def compareCondition(b: uint) {
                    match condition {
                        ResizeCondition::Both => false,
                        ResizeCondition::Downscale => number::gt(target, b),
                        ResizeCondition::Upscale => number::lt(target, b)
                    }
                }

                let same = Size { width: w, height: h };

                let outSize = match side {
                    SideSelection::Width => match compareCondition(w) {
                        true => same,
                        false => Size {
                            width: target,
                            height: max(int & round((target / w) * h), 1)
                        }
                    },
                    SideSelection::Height => match compareCondition(h) {
                        true => same,
                        false => Size {
                            width: max(int & round((target / h) * w), 1),
                            height: target
                        }
                    },
                    SideSelection::Shorter => match compareCondition(min(h, w)) {
                        true => same,
                        false => Size {
                            width: max(int & round((target / min(h, w)) * w), 1),
                            height: max(int & round((target / min(h, w)) * h), 1)
                        }
                    },
                    SideSelection::Longer => match compareCondition(max(h, w)) {
                        true => same,
                        false => Size {
                            width: max(int & round((target / max(h, w)) * w), 1),
                            height: max(int & round((target / max(h, w)) * h), 1)
                        }
                    },
                };

                Image {
                    width: outSize.width,
                    height: outSize.height,
                    channels: Input0.channels
                }
                """
            )
        ]
        self.icon = "MdOutlinePhotoSizeSelectLarge"
        self.sub = "Resize"

    def run(
        self,
        img: np.ndarray,
        target: int,
        side: str,
        interpolation: int,
        condition: str,
    ) -> np.ndarray:
        """Takes an image and resizes it"""

        logger.info(f"Resizing image to {side} via {interpolation}")

        h, w, _ = get_h_w_c(img)
        out_dims = resize_to_side_conditional(w, h, target, side, condition)

        return resize(img, out_dims, interpolation)


@NodeFactory.register("chainner:image:resize_resolution")
class ImResizeToResolutionNode(NodeBase):
    def __init__(self):
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
                    channels="Input0.channels",
                )
            )
        ]
        self.category = ImageDimensionCategory
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
            TileModeInput(),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input1",
                    height="Input2",
                    channels="Input0.channels",
                )
            )
        ]
        self.category = ImageDimensionCategory
        self.name = "Tile Fill"
        self.icon = "MdWindow"
        self.sub = "Resize"

    def run(
        self, img: np.ndarray, width: int, height: int, tile_mode: int
    ) -> np.ndarray:
        return tile_image(img, width, height, tile_mode)


@NodeFactory.register("chainner:image:crop_offsets")
class CropNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Crop an image based on offset from the top-left corner, and the wanted resolution."
        self.inputs = [
            ImageInput(),
            NumberInput("Top Offset", unit="px"),
            NumberInput("Left Offset", unit="px"),
            NumberInput("Height", unit="px", minimum=1, default=1),
            NumberInput("Width", unit="px", minimum=1, default=1),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="min(Input4, Input0.width - Input2) & int(1..)",
                    height="min(Input3, Input0.height - Input1) & int(1..)",
                    channels_as="Input0",
                )
            ).with_never_reason(
                "The cropped area would result in an image with no width or no height."
            )
        ]
        self.category = ImageDimensionCategory
        self.name = "Crop (Offsets)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(
        self, img: np.ndarray, top: int, left: int, height: int, width: int
    ) -> np.ndarray:
        h, w, _ = get_h_w_c(img)

        assert top < h, "Cropped area would result in an image with no height"
        assert left < w, "Cropped area would result in an image with no width"

        result = img[top : top + height, left : left + width]

        return result


@NodeFactory.register("chainner:image:crop_border")
class BorderCropNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Crop an image based on a constant border margin around the entire image."
        )
        self.inputs = [
            ImageInput(),
            NumberInput("Amount", unit="px", minimum=None),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="(Input0.width - Input1 * 2) & int(1..)",
                    height="(Input0.height - Input1 * 2) & int(1..)",
                    channels_as="Input0",
                )
            ).with_never_reason(
                "The cropped area would result in an image with no width or no height."
            )
        ]
        self.category = ImageDimensionCategory
        self.name = "Crop (Border)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(self, img: np.ndarray, amount: int) -> np.ndarray:
        h, w, _ = get_h_w_c(img)

        assert 2 * amount < h, "Cropped area would result in an image with no height"
        assert 2 * amount < w, "Cropped area would result in an image with no width"

        result = img[amount : h - amount, amount : w - amount]

        return result


@NodeFactory.register("chainner:image:crop_edges")
class EdgeCropNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Crop an image using separate amounts from each edge."
        self.inputs = [
            ImageInput(),
            NumberInput("Top", unit="px", minimum=None),
            NumberInput("Left", unit="px", minimum=None),
            NumberInput("Right", unit="px", minimum=None),
            NumberInput("Bottom", unit="px", minimum=None),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="(Input0.width - (Input2 + Input3)) & int(1..)",
                    height="(Input0.height - (Input1 + Input4)) & int(1..)",
                    channels_as="Input0",
                )
            ).with_never_reason(
                "The cropped area would result in an image with no width or no height."
            )
        ]
        self.category = ImageDimensionCategory
        self.name = "Crop (Edges)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(
        self, img: np.ndarray, top: int, left: int, right: int, bottom: int
    ) -> np.ndarray:
        h, w, _ = get_h_w_c(img)

        assert top + bottom < h, "Cropped area would result in an image with no height"
        assert left + right < w, "Cropped area would result in an image with no width"

        result = img[top : h - bottom, left : w - right]

        return result


@NodeFactory.register("chainner:image:crop_content")
class ContentCropNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Crop an image to the boundaries of the visible image content, "
            "removing borders at or below the given opacity threshold."
        )
        self.inputs = [
            ImageInput(),
            SliderInput(
                "Threshold",
                precision=1,
                controls_step=1,
                slider_step=1,
                default=0,
            ),
        ]
        self.outputs = [
            ImageOutput(
                image_type="""
                match Input0.channels {
                    ..3 => Input0,
                    _ => Image { channels: Input0.channels }
                }
                """
            )
        ]
        self.category = ImageDimensionCategory
        self.name = "Crop (Content)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(self, img: np.ndarray, thresh_val: float) -> np.ndarray:
        c = get_h_w_c(img)[2]
        if c < 4:
            return img

        # Threshold value 100 guarantees an empty image, so make sure the max
        # is just below that.
        thresh_val = min(thresh_val / 100, 0.99999)

        # Valid alpha is greater than threshold, else impossible to crop 0 alpha only
        alpha = img[:, :, 3]
        r = np.any(alpha > thresh_val, 1)
        if r.any():
            h, w, _ = get_h_w_c(img)
            c = np.any(alpha > thresh_val, 0)
            imgout = np.copy(img)[
                r.argmax() : h - r[::-1].argmax(), c.argmax() : w - c[::-1].argmax()
            ]
        else:
            raise RuntimeError("Crop results in empty image.")

        return imgout


@NodeFactory.register("chainner:image:get_dims")
class GetDimensionsNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Get the Height, Width, and number of Channels from an image."
        )
        self.inputs = [
            ImageInput(),
        ]
        self.outputs = [
            NumberOutput("Width", output_type="Input0.width"),
            NumberOutput("Height", output_type="Input0.height"),
            NumberOutput("Channels", output_type="Input0.channels"),
        ]
        self.category = ImageDimensionCategory
        self.name = "Get Dimensions"
        self.icon = "BsRulers"
        self.sub = "Utility"

    def run(
        self,
        img: np.ndarray,
    ) -> Tuple[int, int, int]:
        h, w, c = get_h_w_c(img)
        return w, h, c
