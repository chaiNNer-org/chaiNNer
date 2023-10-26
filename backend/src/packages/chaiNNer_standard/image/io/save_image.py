from __future__ import annotations

import os
from enum import Enum
from typing import Literal

import cv2
import numpy as np
from nodes.groups import Condition, if_enum_group, if_group
from nodes.impl.dds.format import (
    BC7_FORMATS,
    BC123_FORMATS,
    LEGACY_TO_DXGI,
    PREFER_DX9,
    WITH_ALPHA,
    DDSFormat,
    to_dxgi,
)
from nodes.impl.dds.texconv import save_as_dds
from nodes.impl.image_utils import cv_save_image, to_uint8, to_uint16
from nodes.properties.inputs import (
    SUPPORTED_DDS_FORMATS,
    BoolInput,
    DdsFormatDropdown,
    DdsMipMapsDropdown,
    DirectoryInput,
    EnumInput,
    ImageInput,
    SliderInput,
    TextInput,
)
from nodes.utils.utils import get_h_w_c
from PIL import Image
from sanic.log import logger

from .. import io_group


class ImageFormat(Enum):
    PNG = "png"
    JPG = "jpg"
    GIF = "gif"
    BMP = "bmp"
    TIFF = "tiff"
    WEBP = "webp"
    TGA = "tga"
    DDS = "dds"

    @property
    def extension(self) -> str:
        return self.value


IMAGE_FORMAT_LABELS: dict[ImageFormat, str] = {
    ImageFormat.PNG: "PNG",
    ImageFormat.JPG: "JPG",
    ImageFormat.GIF: "GIF",
    ImageFormat.BMP: "BMP",
    ImageFormat.TIFF: "TIFF",
    ImageFormat.WEBP: "WEBP",
    ImageFormat.TGA: "TGA",
    ImageFormat.DDS: "DDS",
}


SUPPORTED_FORMATS = {f for f, _ in SUPPORTED_DDS_FORMATS}
SUPPORTED_BC7_FORMATS = list(SUPPORTED_FORMATS.intersection(BC7_FORMATS))
SUPPORTED_BC123_FORMATS = list(SUPPORTED_FORMATS.intersection(BC123_FORMATS))
SUPPORTED_WITH_ALPHA = list(SUPPORTED_FORMATS.intersection(WITH_ALPHA))


class DDSErrorMetric(Enum):
    PERCEPTUAL = 0
    UNIFORM = 1


class BC7Compression(Enum):
    BEST_SPEED = 1
    DEFAULT = 0
    BEST_QUALITY = 2


class JpegSubsampling(Enum):
    FACTOR_444 = int(cv2.IMWRITE_JPEG_SAMPLING_FACTOR_444)
    FACTOR_440 = int(cv2.IMWRITE_JPEG_SAMPLING_FACTOR_440)
    FACTOR_422 = int(cv2.IMWRITE_JPEG_SAMPLING_FACTOR_422)
    FACTOR_420 = int(cv2.IMWRITE_JPEG_SAMPLING_FACTOR_420)


class PngColorDepth(Enum):
    U8 = "u8"
    U16 = "u16"


class TiffColorDepth(Enum):
    U8 = "u8"
    U16 = "u16"
    F32 = "f32"


@io_group.register(
    schema_id="chainner:image:save",
    name="Save Image",
    description="Save image to file at a specified directory.",
    icon="MdSave",
    inputs=[
        ImageInput(),
        DirectoryInput(must_exist=False, has_handle=True),
        TextInput("Subdirectory Path")
        .make_optional()
        .with_docs(
            "An optional subdirectory path. Use this to save the image to a subdirectory of the specified directory. If the subdirectory does not exist, it will be created. Multiple subdirectories can be specified by separating them with a forward slash (`/`).",
            "Example: `foo/bar`",
        ),
        TextInput("Image Name").with_docs(
            "The name of the image file **without** the file extension. If the file already exists, it will be overwritten.",
            "Example: `my-image`",
        ),
        EnumInput(
            ImageFormat,
            "Image Format",
            default=ImageFormat.PNG,
            option_labels=IMAGE_FORMAT_LABELS,
        ).with_id(4),
        if_enum_group(4, ImageFormat.PNG)(
            EnumInput(
                PngColorDepth,
                "Color Depth",
                default=PngColorDepth.U8,
                option_labels={
                    PngColorDepth.U8: "8 Bits/Channel",
                    PngColorDepth.U16: "16 Bits/Channel",
                },
            ).with_id(15),
        ),
        if_enum_group(4, ImageFormat.WEBP)(
            BoolInput("Lossless", default=False).with_id(14),
        ),
        if_group(
            Condition.enum(4, ImageFormat.JPG)
            | (Condition.enum(4, ImageFormat.WEBP) & Condition.enum(14, 0))
        )(
            SliderInput(
                "Quality",
                minimum=0,
                maximum=100,
                default=95,
                slider_step=1,
            ).with_id(5),
        ),
        if_enum_group(4, ImageFormat.JPG)(
            EnumInput(
                JpegSubsampling,
                label="Chroma Subsampling",
                default=JpegSubsampling.FACTOR_422,
                option_labels={
                    JpegSubsampling.FACTOR_444: "4:4:4 (Best Quality)",
                    JpegSubsampling.FACTOR_440: "4:4:0",
                    JpegSubsampling.FACTOR_422: "4:2:2",
                    JpegSubsampling.FACTOR_420: "4:2:0 (Best Compression)",
                },
            ).with_id(11),
            BoolInput("Progressive", default=False).with_id(12),
        ),
        if_enum_group(4, ImageFormat.TIFF)(
            EnumInput(
                TiffColorDepth,
                "Color Depth",
                default=TiffColorDepth.U8,
                option_labels={
                    TiffColorDepth.U8: "8 Bits/Channel",
                    TiffColorDepth.U16: "16 Bits/Channel",
                    TiffColorDepth.F32: "32 Bits/Channel (Float)",
                },
            ).with_id(16),
        ),
        if_enum_group(4, ImageFormat.DDS)(
            DdsFormatDropdown().with_id(6),
            if_enum_group(6, SUPPORTED_BC7_FORMATS)(
                EnumInput(
                    BC7Compression,
                    label="BC7 Compression",
                    default=BC7Compression.DEFAULT,
                ).with_id(7),
            ),
            if_enum_group(6, SUPPORTED_BC123_FORMATS)(
                EnumInput(DDSErrorMetric, label="Error Metric").with_id(9),
                BoolInput("Dithering", default=False).with_id(8),
            ),
            DdsMipMapsDropdown()
            .with_id(10)
            .with_docs(
                "Whether [mipmaps](https://en.wikipedia.org/wiki/Mipmap) will be generated."
                " Mipmaps vastly improve the quality of the image when it is viewed at a smaller size, but they also increase the file size by 33%."
            ),
            if_group(
                Condition.enum(6, SUPPORTED_WITH_ALPHA)
                & Condition.enum(10, 0)
                & Condition.type(0, "Image { channels: 4 }")
            )(
                BoolInput("Separate Alpha for MipMaps", default=False)
                .with_id(13)
                .with_docs(
                    "Enable this option when the alpha channel of an image is **not** transparency.",
                    "The normal method for downscaling images with an alpha channel will remove the color information of transparent pixels (setting them to black). This is a problem if the alpha channel isn't transparency. E.g. games commonly store extra material information in the alpha channel of normal maps. Downscaling color and alpha separately fixes this problem.",
                    "Note: Do not enable this option if the alpha channel is transparency. Otherwise, dark artifacts may appear around transparency edges.",
                ),
            ),
        ),
    ],
    outputs=[],
    side_effects=True,
    limited_to_8bpc="Image will be saved with 8 bits/channel by default. Some formats support higher bit depths.",
)
def save_image_node(
    img: np.ndarray,
    base_directory: str,
    relative_path: str | None,
    filename: str,
    image_format: ImageFormat,
    png_color_depth: PngColorDepth,
    webp_lossless: bool,
    quality: int,
    jpeg_chroma_subsampling: JpegSubsampling,
    jpeg_progressive: bool,
    tiff_color_depth: TiffColorDepth,
    dds_format: DDSFormat,
    dds_bc7_compression: BC7Compression,
    dds_error_metric: DDSErrorMetric,
    dds_dithering: bool,
    dds_mipmap_levels: int,
    dds_separate_alpha: bool,
) -> None:
    """Write an image to the specified path and return write status"""

    full_path = get_full_path(base_directory, relative_path, filename, image_format)
    logger.debug(f"Writing image to path: {full_path}")

    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    # DDS files are handled separately
    if image_format == ImageFormat.DDS:
        # we only support 8bits of precision for DDS
        img = to_uint8(img, normalized=True)

        # remap legacy DX9 formats
        legacy_dds = dds_format in LEGACY_TO_DXGI or dds_format in PREFER_DX9

        save_as_dds(
            full_path,
            img,
            to_dxgi(dds_format),
            mipmap_levels=dds_mipmap_levels,
            dithering=dds_dithering,
            uniform_weighting=dds_error_metric == DDSErrorMetric.UNIFORM,
            minimal_compression=dds_bc7_compression == BC7Compression.BEST_SPEED,
            maximum_compression=dds_bc7_compression == BC7Compression.BEST_QUALITY,
            dx9=legacy_dds,
            separate_alpha=dds_separate_alpha,
        )
        return

    # Some formats are handled by PIL
    if image_format in (ImageFormat.GIF, ImageFormat.TGA):
        # we only support 8bits of precision for those formats
        img = to_uint8(img, normalized=True)

        channels = get_h_w_c(img)[2]
        if channels == 1:
            # PIL supports grayscale images just fine, so we don't need to do any conversion
            pass
        elif channels == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        elif channels == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA)
        else:
            raise RuntimeError(
                f"Unsupported number of channels. Saving .{image_format.extension} images is only supported for "
                f"grayscale, RGB, and RGBA images."
            )

        with Image.fromarray(img) as image:
            image.save(full_path)

    else:
        params: list[int]
        if image_format == ImageFormat.JPG:
            params = [
                cv2.IMWRITE_JPEG_QUALITY,
                quality,
                cv2.IMWRITE_JPEG_SAMPLING_FACTOR,
                jpeg_chroma_subsampling.value,
                cv2.IMWRITE_JPEG_PROGRESSIVE,
                int(jpeg_progressive),
            ]
        elif image_format == ImageFormat.WEBP:
            params = [cv2.IMWRITE_WEBP_QUALITY, 101 if webp_lossless else quality]
        else:
            params = []

        # the bit depth depends on the image format and settings
        precision: Literal["u8", "u16", "f32"] = "u8"
        if image_format == ImageFormat.PNG:
            if png_color_depth == PngColorDepth.U16:
                precision = "u16"
        elif image_format == ImageFormat.TIFF:
            if tiff_color_depth == TiffColorDepth.U16:
                precision = "u16"
            elif tiff_color_depth == TiffColorDepth.F32:
                precision = "f32"

        if precision == "u8":
            img = to_uint8(img, normalized=True)
        elif precision == "u16":
            img = to_uint16(img, normalized=True)
        elif precision == "f32":
            # chainner images are always f32
            pass

        cv_save_image(full_path, img, params)


def get_full_path(
    base_directory: str,
    relative_path: str | None,
    filename: str,
    image_format: ImageFormat,
) -> str:
    file = f"{filename}.{image_format.extension}"
    if relative_path and relative_path != ".":
        base_directory = os.path.join(base_directory, relative_path)
    full_path = os.path.join(base_directory, file)
    return full_path
