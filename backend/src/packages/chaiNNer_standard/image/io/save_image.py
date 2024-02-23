from __future__ import annotations

import os
from enum import Enum
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from PIL import Image
from sanic.log import logger

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
    name="保存图像",
    description="将图像保存到指定目录。",
    icon="MdSave",
    inputs=[
        ImageInput("图像"),
        DirectoryInput(must_exist=False, has_handle=True, label="目录"),
        TextInput("子目录路径")
        .make_optional()
        .with_docs(
            "可选的子目录路径。使用此选项将图像保存到指定目录的子目录中。如果子目录不存在，将创建它。可以通过使用斜杠 (`/`) 分隔它们来指定多个子目录。",
            "示例: `foo/bar`",
        ),
        TextInput("图像名称").with_docs(
            "图像文件的名称 **不包括** 文件扩展名。如果文件已经存在，将覆盖它。",
            "示例: `my-image`",
        ),
        EnumInput(
            ImageFormat,
            "图像格式",
            default=ImageFormat.PNG,
            option_labels=IMAGE_FORMAT_LABELS,
        ).with_id(4),
        if_enum_group(4, ImageFormat.PNG)(
            EnumInput(
                PngColorDepth,
                "颜色深度",
                default=PngColorDepth.U8,
                option_labels={
                    PngColorDepth.U8: "8 位/通道",
                    PngColorDepth.U16: "16 位/通道",
                },
            ).with_id(15),
        ),
        if_enum_group(4, ImageFormat.WEBP)(
            BoolInput("无损压缩", default=False).with_id(14),
        ),
        if_group(
            Condition.enum(4, ImageFormat.JPG)
            | (Condition.enum(4, ImageFormat.WEBP) & Condition.enum(14, 0))
        )(
            SliderInput(
                "质量",
                minimum=0,
                maximum=100,
                default=95,
                slider_step=1,
            ).with_id(5),
        ),
        if_enum_group(4, ImageFormat.JPG)(
            EnumInput(
                JpegSubsampling,
                label="色度子采样",
                default=JpegSubsampling.FACTOR_422,
                option_labels={
                    JpegSubsampling.FACTOR_444: "4:4:4 (最佳质量)",
                    JpegSubsampling.FACTOR_440: "4:4:0",
                    JpegSubsampling.FACTOR_422: "4:2:2",
                    JpegSubsampling.FACTOR_420: "4:2:0 (最佳压缩)",
                },
            ).with_id(11),
            BoolInput("渐进", default=False).with_id(12),
        ),
        if_enum_group(4, ImageFormat.TIFF)(
            EnumInput(
                TiffColorDepth,
                "颜色深度",
                default=TiffColorDepth.U8,
                option_labels={
                    TiffColorDepth.U8: "8 位/通道",
                    TiffColorDepth.U16: "16 位/通道",
                    TiffColorDepth.F32: "32 位/通道 (浮点数)",
                },
            ).with_id(16),
        ),
        if_enum_group(4, ImageFormat.DDS)(
            DdsFormatDropdown().with_id(6),
            if_enum_group(6, SUPPORTED_BC7_FORMATS)(
                EnumInput(
                    BC7Compression,
                    label="BC7 压缩",
                    default=BC7Compression.DEFAULT,
                ).with_id(7),
            ),
            if_enum_group(6, SUPPORTED_BC123_FORMATS)(
                EnumInput(DDSErrorMetric, label="错误度量").with_id(9),
                BoolInput("抖动", default=False).with_id(8),
            ),
            DdsMipMapsDropdown()
            .with_id(10)
            .with_docs(
                "是否生成 [mipmaps](https://en.wikipedia.org/wiki/Mipmap)。",
                "Mipmaps 在以较小的尺寸查看图像时极大地提高图像质量，但它们也会使文件大小增加 33%。",
            ),
            if_group(
                Condition.enum(6, SUPPORTED_WITH_ALPHA)
                & Condition.enum(10, 0)
                & Condition.type(0, "Image { channels: 4 }")
            )(
                BoolInput("为 MipMaps 单独使用 Alpha 通道", default=False)
                .with_id(13)
                .with_docs(
                    "当图像的 Alpha 通道 **不是** 透明时启用此选项。",
                    "使用 Alpha 通道缩小图像的普通方法会删除透明像素的颜色信息（将其设置为黑色）。如果 Alpha 通道不是透明，则这可能是一个问题。例如，游戏通常在法线贴图的 Alpha 通道中存储额外的材质信息。单独缩小颜色和 Alpha 可以解决此问题。",
                    "注意: 如果 Alpha 通道是透明，请不要启用此选项。否则，透明边缘周围可能会出现深色伪影。",
                ),
            ),
        ),
    ],
    outputs=[],
    side_effects=True,
    limited_to_8bpc="图像将默认以 8 位/通道保存。某些格式支持更高的位深度。",
)
def save_image_node(
    img: np.ndarray,
    base_directory: Path,
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
    base_directory: Path,
    relative_path: str | None,
    filename: str,
    image_format: ImageFormat,
) -> Path:
    file = f"{filename}.{image_format.extension}"
    if relative_path and relative_path != ".":
        base_directory = base_directory / relative_path
    full_path = base_directory / file
    return full_path
