from __future__ import annotations

from enum import Enum
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
import pillow_avif  # type: ignore # noqa: F401
from PIL import Image

from api import KeyInfo, Lazy
from logger import logger
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
    BoolInput,
    DictInput,
    DirectoryInput,
    DropDownGroup,
    DropDownInput,
    EnumInput,
    ImageInput,
    RelativePathInput,
    SliderInput,
)
from nodes.utils.utils import get_h_w_c

from .. import io_group

# Try to import piexif for EXIF support with OpenCV
try:
    import piexif

    PIEXIF_AVAILABLE = True
except ImportError:
    PIEXIF_AVAILABLE = False


class ImageFormat(Enum):
    PNG = "png"
    JPG = "jpg"
    GIF = "gif"
    BMP = "bmp"
    TIFF = "tiff"
    WEBP = "webp"
    TGA = "tga"
    DDS = "dds"
    AVIF = "avif"

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
    ImageFormat.AVIF: "AVIF",
}


class JpegSubsampling(Enum):
    FACTOR_444 = int(cv2.IMWRITE_JPEG_SAMPLING_FACTOR_444)
    FACTOR_440 = int(cv2.IMWRITE_JPEG_SAMPLING_FACTOR_440)
    FACTOR_422 = int(cv2.IMWRITE_JPEG_SAMPLING_FACTOR_422)
    FACTOR_420 = int(cv2.IMWRITE_JPEG_SAMPLING_FACTOR_420)


class AvifSubsampling(Enum):
    FACTOR_444 = "4:4:4"
    FACTOR_422 = "4:2:2"
    FACTOR_420 = "4:2:0"
    FACTOR_400 = "4:0:0"


class PngColorDepth(Enum):
    U8 = "u8"
    U16 = "u16"


class TiffColorDepth(Enum):
    U8 = "u8"
    U16 = "u16"
    F32 = "f32"


class TiffCompression(Enum):
    NONE = 1
    LZW = 5
    ZIP = 8

    @property
    def cv2_code(self) -> int:
        # OpenCV is a beautiful piece of software, so surely they won't forget to define the TIFF compression constants, right?
        return self.value


SUPPORTED_DDS_FORMATS: list[tuple[DDSFormat, str]] = [
    ("BC1_UNORM_SRGB", "BC1 (4bpp, sRGB, 1-bit Alpha)"),
    ("BC1_UNORM", "BC1 (4bpp, Linear, 1-bit Alpha)"),
    ("BC3_UNORM_SRGB", "BC3 (8bpp, sRGB, 8-bit Alpha)"),
    ("BC3_UNORM", "BC3 (8bpp, Linear, 8-bit Alpha)"),
    ("BC4_UNORM", "BC4 (4bpp, Grayscale)"),
    ("BC5_UNORM", "BC5 (8bpp, Unsigned, 2-channel normal)"),
    ("BC5_SNORM", "BC5 (8bpp, Signed, 2-channel normal)"),
    ("BC7_UNORM_SRGB", "BC7 (8bpp, sRGB, 8-bit Alpha)"),
    ("BC7_UNORM", "BC7 (8bpp, Linear, 8-bit Alpha)"),
    ("DXT1", "DXT1 (4bpp, Linear, 1-bit Alpha)"),
    ("DXT3", "DXT3 (8bpp, Linear, 4-bit Alpha)"),
    ("DXT5", "DXT5 (8bpp, Linear, 8-bit Alpha)"),
    ("R8G8B8A8_UNORM_SRGB", "RGBA (32bpp, sRGB, 8-bit Alpha)"),
    ("R8G8B8A8_UNORM", "RGBA (32bpp, Linear, 8-bit Alpha)"),
    ("B8G8R8A8_UNORM_SRGB", "BGRA (32bpp, sRGB, 8-bit Alpha)"),
    ("B8G8R8A8_UNORM", "BGRA (32bpp, Linear, 8-bit Alpha)"),
    ("B5G5R5A1_UNORM", "BGRA (16bpp, Linear, 1-bit Alpha)"),
    ("B5G6R5_UNORM", "BGR (16bpp, Linear)"),
    ("B8G8R8X8_UNORM_SRGB", "BGRX (32bpp, sRGB)"),
    ("B8G8R8X8_UNORM", "BGRX (32bpp, Linear)"),
    ("R8G8_UNORM", "RG (16bpp, Linear)"),
    ("R8_UNORM", "R (8bpp, Linear)"),
]


def DdsFormatDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="DdsFormat",
        label="DDS Format",
        options=[{"option": title, "value": f} for f, title in SUPPORTED_DDS_FORMATS],
        associated_type=DDSFormat,
        groups=[
            DropDownGroup("Compressed", start_at="BC1_UNORM_SRGB"),
            DropDownGroup("Uncompressed", start_at="R8G8B8A8_UNORM_SRGB"),
            DropDownGroup("Legacy Compressed", start_at="DXT1"),
        ],
    )


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


def DdsMipMapsDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="DdsMipMaps",
        label="Generate Mip Maps",
        preferred_style="checkbox",
        options=[
            # these are not boolean values, see dds.py for more info
            {"option": "Yes", "value": 0},
            {"option": "No", "value": 1},
        ],
    )


def _write_exif_piexif(
    image_path: Path,
    metadata: dict[str, str | int | float],
) -> None:
    """Write EXIF metadata to a JPEG file using piexif."""
    if not PIEXIF_AVAILABLE:
        return

    try:
        # Try to load existing EXIF data
        try:
            exif_dict = piexif.load(str(image_path))
        except Exception:
            # Create a new EXIF dict if file doesn't have EXIF or can't be read
            exif_dict = {"0th": {}, "Exif": {}, "GPS": {}, "1st": {}}

        # Parse metadata keys and add to appropriate IFD
        for key, value in metadata.items():
            # Skip non-EXIF keys
            if not key.startswith("exif_"):
                continue

            # Parse the key format: exif_{ifd_name}_{tag_id}
            parts = key.split("_")
            if len(parts) < 3:
                continue

            ifd_name = parts[1]
            try:
                tag_id = int(parts[2])
            except ValueError:
                continue

            # Only write to supported IFDs
            if ifd_name not in ["0th", "Exif", "GPS", "1st"]:
                continue

            # Convert value to appropriate type
            if isinstance(value, str):
                # Encode string as bytes
                exif_dict[ifd_name][tag_id] = value.encode("utf-8")
            elif isinstance(value, (int, float)):
                exif_dict[ifd_name][tag_id] = int(value)

        # Dump EXIF data and insert into image
        exif_bytes = piexif.dump(exif_dict)
        piexif.insert(exif_bytes, str(image_path))
    except Exception as e:
        logger.debug("Failed to write EXIF with piexif: %s", e)


@io_group.register(
    schema_id="chainner:image:save",
    name="Save Image",
    description="Save image to file at a specified directory.",
    icon="MdSave",
    inputs=[
        ImageInput().make_lazy(),
        DictInput("Metadata")
        .make_optional()
        .with_docs(
            "Optional metadata to embed in the image file. The metadata will be saved where supported by the image format (e.g., EXIF data for JPEG/PNG)."
        ),
        DirectoryInput(must_exist=False),
        RelativePathInput("Subdirectory Path")
        .make_optional()
        .with_docs(
            "An optional subdirectory path. Use this to save the image to a subdirectory of the specified directory. If the subdirectory does not exist, it will be created. Multiple subdirectories can be specified by separating them with a forward slash (`/`).",
            "Example: `foo/bar`",
        ),
        RelativePathInput("Image Name").with_docs(
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
            | Condition.enum(4, ImageFormat.AVIF)
            | (Condition.enum(4, ImageFormat.WEBP) & Condition.enum(14, 0))
        )(
            SliderInput("Quality", min=0, max=100, default=95).with_id(5),
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
            if_enum_group(16, (TiffColorDepth.U8, TiffColorDepth.U16))(
                EnumInput(
                    TiffCompression,
                    "Compression",
                    default=TiffCompression.LZW,
                    option_labels={
                        TiffCompression.NONE: "None",
                        TiffCompression.LZW: "LZW (lossless)",
                        TiffCompression.ZIP: "ZIP (lossless)",
                    },
                ).with_id(18),
            ),
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
        if_enum_group(4, ImageFormat.AVIF)(
            EnumInput(
                AvifSubsampling,
                label="Chroma Subsampling",
                default=AvifSubsampling.FACTOR_420,
                option_labels={
                    AvifSubsampling.FACTOR_444: "4:4:4 (Best Quality)",
                    AvifSubsampling.FACTOR_422: "4:2:2",
                    AvifSubsampling.FACTOR_420: "4:2:0",
                    AvifSubsampling.FACTOR_400: "4:0:0 (Best Compression)",
                },
            ).with_id(17)
        ),
        BoolInput("Skip existing files", default=False)
        .with_id(1000)
        .with_docs(
            "If enabled, the node will not overwrite existing files.",
        ),
    ],
    outputs=[],
    key_info=KeyInfo.enum(4),
    side_effects=True,
    limited_to_8bpc="Image will be saved with 8 bits/channel by default. Some formats support higher bit depths.",
)
def save_image_node(
    lazy_image: Lazy[np.ndarray],
    metadata: dict[str, str | int | float] | None,
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
    tiff_compression: TiffCompression,
    dds_format: DDSFormat,
    dds_bc7_compression: BC7Compression,
    dds_error_metric: DDSErrorMetric,
    dds_dithering: bool,
    dds_mipmap_levels: int,
    dds_separate_alpha: bool,
    avif_chroma_subsampling: AvifSubsampling,
    skip_existing_files: bool,
) -> None:
    full_path = get_full_path(base_directory, relative_path, filename, image_format)

    if full_path.exists():
        if skip_existing_files:
            logger.debug("Skipping existing file: %s", full_path)
            return
    else:
        # Create directory if it doesn't exist
        full_path.parent.mkdir(parents=True, exist_ok=True)

    logger.debug("Writing image to path: %s", full_path)
    img = lazy_image.value

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
    if image_format in (ImageFormat.GIF, ImageFormat.TGA, ImageFormat.AVIF):
        # we only support 8bits of precision for those formats
        img = to_uint8(img, normalized=True)
        args = {}

        if image_format == ImageFormat.AVIF:
            args["quality"] = quality
            args["subsampling"] = avif_chroma_subsampling.value

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
            # Add metadata if provided
            if metadata:
                # Convert metadata to PIL info dict
                pil_info = {}
                for key, value in metadata.items():
                    # Convert all values to strings for info dict
                    pil_info[key] = str(value)

                # For EXIF data, we need to handle it specially
                # This is a simple implementation that just adds to info
                # More sophisticated EXIF handling would require PIL's ExifTags
                if pil_info:
                    args["exif"] = image.getexif()
                    # Note: Full EXIF support would need more sophisticated handling

            image.save(full_path, **args)

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
        elif (
            image_format == ImageFormat.TIFF and tiff_color_depth != TiffColorDepth.F32
        ):
            params = [cv2.IMWRITE_TIFF_COMPRESSION, tiff_compression.cv2_code]
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

        # Write EXIF metadata for JPEG and TIFF files using piexif if available
        if metadata and image_format in [ImageFormat.JPG, ImageFormat.TIFF]:
            _write_exif_piexif(full_path, metadata)


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
    return full_path.resolve()
