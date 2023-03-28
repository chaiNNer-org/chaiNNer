from __future__ import annotations

import os
from enum import Enum

import cv2
import numpy as np
from PIL import Image
from sanic.log import logger

from nodes.groups import Condition, if_enum_group, if_group
from nodes.impl.dds.format import (
    BC7_FORMATS,
    BC123_FORMATS,
    LEGACY_TO_DXGI,
    WITH_ALPHA,
    DDSFormat,
    to_dxgi,
)
from nodes.impl.dds.texconv import save_as_dds
from nodes.impl.image_utils import cv_save_image, to_uint8
from nodes.properties.inputs import (
    SUPPORTED_DDS_FORMATS,
    BoolInput,
    DdsFormatDropdown,
    DdsMipMapsDropdown,
    DirectoryInput,
    EnumInput,
    ImageExtensionDropdown,
    ImageInput,
    SliderInput,
    TextInput,
)
from nodes.utils.utils import get_h_w_c

from .. import io_group

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


@io_group.register(
    schema_id="chainner:image:save",
    name="Save Image",
    description="Save image to file at a specified directory.",
    icon="MdSave",
    inputs=[
        ImageInput(),
        DirectoryInput(has_handle=True),
        TextInput("Subdirectory Path").make_optional(),
        TextInput("Image Name"),
        ImageExtensionDropdown().with_id(4),
        if_enum_group(4, ["jpg", "webp"])(
            SliderInput(
                "Quality",
                minimum=0,
                maximum=100,
                default=95,
                slider_step=1,
            ),
        ),
        if_enum_group(4, "jpg")(
            EnumInput(
                JpegSubsampling,
                label="Chroma Subsampling",
                default_value=JpegSubsampling.FACTOR_422,
                option_labels={
                    JpegSubsampling.FACTOR_444: "4:4:4 (Best Quality)",
                    JpegSubsampling.FACTOR_440: "4:4:0",
                    JpegSubsampling.FACTOR_422: "4:2:2",
                    JpegSubsampling.FACTOR_420: "4:2:0 (Best Compression)",
                },
            ).with_id(11),
            BoolInput("Progressive", default=False).with_id(12),
        ),
        if_enum_group(4, "dds")(
            DdsFormatDropdown().with_id(6),
            if_enum_group(6, SUPPORTED_BC7_FORMATS)(
                EnumInput(
                    BC7Compression,
                    label="BC7 Compression",
                    default_value=BC7Compression.DEFAULT,
                ).with_id(7),
            ),
            if_enum_group(6, SUPPORTED_BC123_FORMATS)(
                EnumInput(DDSErrorMetric, label="Error Metric").with_id(9),
                BoolInput("Dithering", default=False).with_id(8),
            ),
            DdsMipMapsDropdown().with_id(10),
            if_group(Condition.enum(6, SUPPORTED_WITH_ALPHA) & Condition.enum(10, 0))(
                BoolInput("Separate Alpha for Mip Maps", default=False).with_id(13),
            ),
        ),
    ],
    outputs=[],
    side_effects=True,
)
def save_image_node(
    img: np.ndarray,
    base_directory: str,
    relative_path: str | None,
    filename: str,
    extension: str,
    quality: int,
    chroma_subsampling: JpegSubsampling,
    progressive: bool,
    dds_format: DDSFormat,
    dds_bc7_compression: BC7Compression,
    dds_error_metric: DDSErrorMetric,
    dds_dithering: bool,
    dds_mipmap_levels: int,
    dds_separate_alpha: bool,
) -> None:
    """Write an image to the specified path and return write status"""

    lossless = False
    if extension == "webp-lossless":
        extension = "webp"
        lossless = True

    full_file = f"{filename}.{extension}"
    if relative_path and relative_path != ".":
        base_directory = os.path.join(base_directory, relative_path)
    full_path = os.path.join(base_directory, full_file)

    logger.debug(f"Writing image to path: {full_path}")

    # Put image back in int range
    img = to_uint8(img, normalized=True)

    os.makedirs(base_directory, exist_ok=True)

    # DDS files are handled separately
    if extension == "dds":
        # remap legacy DX9 formats
        legacy_dds = dds_format in LEGACY_TO_DXGI

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

    # Any image not supported by cv2, will be handled by pillow.
    if extension not in ["png", "jpg", "tiff", "webp"]:
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
                f"Unsupported number of channels. Saving .{extension} images is only supported for "
                f"grayscale, RGB, and RGBA images."
            )
        with Image.fromarray(img) as image:
            image.save(full_path)
    else:
        if extension == "jpg":
            params = [
                cv2.IMWRITE_JPEG_QUALITY,
                quality,
                cv2.IMWRITE_JPEG_SAMPLING_FACTOR,
                chroma_subsampling.value,
                cv2.IMWRITE_JPEG_PROGRESSIVE,
                int(progressive),
            ]
        elif extension == "webp":
            params = [cv2.IMWRITE_WEBP_QUALITY, 101 if lossless else quality]
        else:
            params = []

        cv_save_image(full_path, img, params)
