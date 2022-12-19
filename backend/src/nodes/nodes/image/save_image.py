from __future__ import annotations
from enum import Enum

import os
from typing import Union

import cv2
import numpy as np
from PIL import Image
from sanic.log import logger

from . import category as ImageCategory
from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import (
    ImageInput,
    DirectoryInput,
    TextInput,
    ImageExtensionDropdown,
    SliderInput,
    DdsFormatDropdown,
    BoolInput,
    EnumInput,
    DdsMipMapsDropdown,
)
from ...utils.utils import get_h_w_c
from ...impl.image_utils import cv_save_image
from ...impl.dds import save_as_dds

BC7_FORMATS = "BC7_UNORM_SRGB", "BC7_UNORM"
BC1_BC3_FORMATS = "BC1_UNORM_SRGB", "BC1_UNORM", "BC3_UNORM_SRGB", "BC3_UNORM"


class DDSErrorMetric(Enum):
    PERCEPTUAL = 0
    UNIFORM = 1


class BC7Compression(Enum):
    BEST_SPEED = 1
    DEFAULT = 0
    BEST_QUALITY = 2


@NodeFactory.register("chainner:image:save")
class ImWriteNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Save image to file at a specified directory."
        self.inputs = [
            ImageInput(),
            DirectoryInput(has_handle=True),
            TextInput("Subdirectory Path").make_optional(),
            TextInput("Image Name"),
            ImageExtensionDropdown().with_id(4),
            group(
                "conditional-enum",
                {
                    "enum": 4,
                    "conditions": [["jpg", "webp"], "dds", "dds", "dds"],
                },
            )(
                SliderInput(
                    "Quality",
                    minimum=0,
                    maximum=100,
                    default=95,
                    slider_step=1,
                ),
                DdsFormatDropdown().with_id(6),
                group(
                    "conditional-enum",
                    {
                        "enum": 6,
                        "conditions": [BC7_FORMATS, BC1_BC3_FORMATS, BC1_BC3_FORMATS],
                    },
                )(
                    EnumInput(
                        BC7Compression,
                        label="BC7 Compression",
                        default_value=BC7Compression.DEFAULT,
                    ).with_id(7),
                    EnumInput(DDSErrorMetric, label="Error Metric").with_id(9),
                    BoolInput("Dithering", default=False).with_id(8),
                ),
                DdsMipMapsDropdown().with_id(10),
            ),
        ]
        self.category = ImageCategory
        self.name = "Save Image"
        self.outputs = []
        self.icon = "MdSave"
        self.sub = "Input & Output"

        self.side_effects = True

    def run(
        self,
        img: np.ndarray,
        base_directory: str,
        relative_path: Union[str, None],
        filename: str,
        extension: str,
        quality: int,
        dds_format: str,
        dds_bc7_compression: int,
        dds_uniform_weighting: int,
        dds_dithering: bool,
        dds_mipmap_levels: int,
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
        img = (np.clip(img, 0, 1) * 255).round().astype("uint8")

        os.makedirs(base_directory, exist_ok=True)

        # DDS files are handled separately
        if extension == "dds":
            save_as_dds(
                full_path,
                img,
                dds_format,
                mipmap_levels=dds_mipmap_levels,
                dithering=dds_dithering,
                uniform_weighting=bool(dds_uniform_weighting),
                minimal_compression=dds_bc7_compression == BC7Compression.BEST_SPEED,
                maximum_compression=dds_bc7_compression == BC7Compression.BEST_QUALITY,
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
                params = [cv2.IMWRITE_JPEG_QUALITY, quality]
            elif extension == "webp":
                params = [cv2.IMWRITE_WEBP_QUALITY, 101 if lossless else quality]
            else:
                params = []

            cv_save_image(full_path, img, params)
