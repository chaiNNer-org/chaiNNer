from __future__ import annotations

import os
import random
import string
from typing import Union

import cv2
import numpy as np
from PIL import Image
from sanic.log import logger

from . import category as ImageCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import (
    ImageInput,
    DirectoryInput,
    TextInput,
    ImageExtensionDropdown,
)
from ...utils.pil_utils import *
from ...utils.utils import get_h_w_c


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
            ImageExtensionDropdown(),
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
    ):
        """Write an image to the specified path and return write status"""

        full_file = f"{filename}.{extension}"
        if relative_path and relative_path != ".":
            base_directory = os.path.join(base_directory, relative_path)
        full_path = os.path.join(base_directory, full_file)

        logger.debug(f"Writing image to path: {full_path}")

        # Put image back in int range
        img = (np.clip(img, 0, 1) * 255).round().astype("uint8")

        os.makedirs(base_directory, exist_ok=True)
        # Any image not supported by cv2, will be handled by pillow.
        if extension not in ["png", "jpg", "gif", "tiff", "webp"]:
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
            # Write image with opencv if path is ascii, since imwrite doesn't support unicode
            # This saves us from having to keep the image buffer in memory, if possible
            if full_path.isascii():
                cv2.imwrite(full_path, img)
            else:
                try:
                    temp_filename = f'temp-{"".join(random.choices(string.ascii_letters, k=16))}.{extension}'
                    full_temp_path = full_path.replace(full_file, temp_filename)
                    cv2.imwrite(full_temp_path, img)
                    os.rename(full_temp_path, full_path)
                except:
                    _, buf_img = cv2.imencode(f".{extension}", img)
                    with open(full_path, "wb") as outf:
                        outf.write(buf_img)
