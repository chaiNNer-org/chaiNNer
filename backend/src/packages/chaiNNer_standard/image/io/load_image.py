from __future__ import annotations

import os
import platform
from typing import Callable, Iterable, List, Set, Tuple, Union

import cv2
import numpy as np
from PIL import Image
from sanic.log import logger

from nodes.impl.dds.texconv import dds_to_png_texconv
from nodes.impl.image_formats import get_opencv_formats, get_pil_formats
from nodes.properties.inputs import ImageFileInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput, LargeImageOutput
from nodes.utils.utils import get_h_w_c, split_file_path

from .. import io_group

_Decoder = Callable[[str], Union[np.ndarray, None]]
"""
An image decoder.

Of the given image is naturally not supported, the decoder may return `None`
instead of raising an exception. E.g. when the file extension indicates an
unsupported format.
"""


def get_ext(path: str) -> str:
    return split_file_path(path)[2].lower()


def _read_cv(path: str) -> np.ndarray | None:
    if get_ext(path) not in get_opencv_formats():
        # not supported
        return None

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


def _read_pil(path: str) -> np.ndarray | None:
    if get_ext(path) not in get_pil_formats():
        # not supported
        return None

    im = Image.open(path)
    img = np.array(im)
    _, _, c = get_h_w_c(img)
    if c == 3:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    elif c == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGRA)
    return img


def _read_dds(path: str) -> np.ndarray | None:
    if get_ext(path) != ".dds":
        # not supported
        return None

    if platform.system() != "Windows":
        # texconv is only supported on Windows.
        return None

    png = dds_to_png_texconv(path)
    try:
        return _read_cv(png)
    finally:
        os.remove(png)


def _for_ext(ext: str | Iterable[str], decoder: _Decoder) -> _Decoder:
    ext_set: Set[str] = set()
    if isinstance(ext, str):
        ext_set.add(ext)
    else:
        ext_set.update(ext)

    return lambda path: decoder(path) if get_ext(path) in ext_set else None


_decoders: List[Tuple[str, _Decoder]] = [
    ("pil-jpeg", _for_ext([".jpg", ".jpeg"], _read_pil)),
    ("cv", _read_cv),
    ("pil", _read_pil),
    ("texconv-dds", _read_dds),
]


@io_group.register(
    schema_id="chainner:image:load",
    name="Load Image",
    description="Load image from specified file.",
    icon="BsFillImageFill",
    inputs=[ImageFileInput(primary_input=True)],
    outputs=[
        LargeImageOutput(),
        DirectoryOutput("Image Directory", of_input=0),
        FileNameOutput("Image Name", of_input=0),
    ],
)
def load_image_node(path: str) -> Tuple[np.ndarray, str, str]:
    """Reads an image from the specified path and return it as a numpy array"""

    logger.debug(f"Reading image from path: {path}")

    dirname, basename, _ = split_file_path(path)

    img = None
    error = None
    for name, decoder in _decoders:
        try:
            img = decoder(path)
        except Exception as e:
            error = e
            logger.warning(f"Decoder {name} failed")

        if img is not None:
            break

    if img is None:
        if error is not None:
            raise error
        raise RuntimeError(
            f'The image "{path}" you are trying to read cannot be read by chaiNNer.'
        )

    return img, dirname, basename
