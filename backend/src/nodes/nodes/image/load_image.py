from __future__ import annotations

import os
from typing import Tuple, Union
import platform

import cv2
import numpy as np
from PIL import Image
from sanic.log import logger

from . import category as ImageCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageFileInput
from ...properties.outputs import LargeImageOutput, DirectoryOutput, TextOutput
from ...impl.dds import dds_to_png_texconv
from ...impl.image_utils import get_opencv_formats, get_pil_formats, normalize
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:load")
class ImReadNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Load image from specified file."
        self.inputs = [ImageFileInput(primary_input=True)]
        self.outputs = [
            LargeImageOutput(),
            DirectoryOutput("Image Directory"),
            TextOutput("Image Name"),
        ]

        self.category = ImageCategory
        self.name = "Load Image"
        self.icon = "BsFillImageFill"
        self.sub = "Input & Output"

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
        _base, ext = os.path.splitext(path)

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

        dirname, basename = os.path.split(os.path.splitext(path)[0])
        return img, dirname, basename
