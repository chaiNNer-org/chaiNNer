from __future__ import annotations

import os
from typing import Tuple, Union
import platform

import cv2
import numpy as np
from PIL import Image
from sanic.log import logger

from nodes.node_base import NodeBase
from nodes.properties.inputs import ImageFileInput
from nodes.properties.outputs import (
    LargeImageOutput,
    DirectoryOutput,
    FileNameOutput,
)
from nodes.impl.dds import dds_to_png_texconv
from nodes.impl.image_formats import get_opencv_formats, get_pil_formats
from nodes.impl.image_utils import normalize
from nodes.utils.utils import get_h_w_c, split_file_path

from . import io


@io.register()
class ImReadNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.inputs = [ImageFileInput(primary_input=True)]
        self.outputs = [
            LargeImageOutput(),
            DirectoryOutput("Image Directory", of_input=0),
            FileNameOutput("Image Name", of_input=0),
        ]

        self.schema_id = "chainner:image:load"
        self.description = "Load image from specified file."
        self.name = "Load Image"
        self.icon = "BsFillImageFill"

    def read_cv(self, path: str) -> np.ndarray:
        img = None
        try:
            img = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
        except Exception as cv_err:
            logger.warning(f"Error loading image, trying with imdecode: {cv_err}")

        if img is None:
            try:
                img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
            except Exception as e:
                raise RuntimeError(
                    f'Error reading image image from path "{path}". Image may be corrupt.'
                ) from e

        if img is None:
            raise RuntimeError(
                f'Error reading image image from path "{path}". Image may be corrupt.'
            )

        return img

    def read_pil(self, path: str) -> np.ndarray:
        im = Image.open(path)
        img = np.array(im)
        _, _, c = get_h_w_c(img)
        if c == 3:
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        elif c == 4:
            img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGRA)
        return img

    def read_dds(self, path: str) -> Union[np.ndarray, None]:
        if platform.system() != "Windows":
            # texconv is only supported on Windows.
            return None

        png = dds_to_png_texconv(path)
        try:
            return self.read_cv(png)
        finally:
            os.remove(png)

    def run(self, path: str) -> Tuple[np.ndarray, str, str]:
        """Reads an image from the specified path and return it as a numpy array"""

        logger.debug(f"Reading image from path: {path}")

        dirname, basename, ext = split_file_path(path)

        supported_by_cv = ext.lower() in get_opencv_formats()
        supported_by_pil = ext.lower() in get_pil_formats()

        if not supported_by_cv and not supported_by_pil:
            raise NotImplementedError(
                f'The image "{path}" you are trying to read cannot be read by chaiNNer.'
            )

        img = None
        error = None
        if supported_by_cv:
            try:
                img = self.read_cv(path)
            except Exception as e:
                error = e
        if img is None and supported_by_pil:
            try:
                img = self.read_pil(path)
            except Exception as e:
                error = e
        if img is None and ext.lower() == ".dds":
            try:
                img = self.read_dds(path)
            except Exception as e:
                error = e

        if img is None:
            if error is not None:
                raise error
            raise RuntimeError(f'Internal error loading image "{path}".')

        img = normalize(img)

        return img, dirname, basename
