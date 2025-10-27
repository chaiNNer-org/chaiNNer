from __future__ import annotations

import os
import platform
from pathlib import Path
from typing import Callable, Iterable, Union

import cv2
import numpy as np
import pillow_avif  # type: ignore # noqa: F401
from PIL import Image

from logger import logger
from nodes.impl.dds.texconv import dds_to_png_texconv
from nodes.impl.image_formats import (
    get_available_image_formats,
    get_opencv_formats,
    get_pil_formats,
)
from nodes.properties.inputs import ImageFileInput
from nodes.properties.outputs import (
    DictOutput,
    DirectoryOutput,
    FileNameOutput,
    LargeImageOutput,
)
from nodes.utils.utils import get_h_w_c, split_file_path

from .. import io_group

_Decoder = Callable[[Path], Union[tuple[np.ndarray, dict[str, str | int | float]], None]]
"""
An image decoder.

Of the given image is naturally not supported, the decoder may return `None`
instead of raising an exception. E.g. when the file extension indicates an
unsupported format.

Returns a tuple of (image, metadata_dict) if successful.
"""


def get_ext(path: Path | str) -> str:
    return split_file_path(path)[2].lower()


def remove_unnecessary_alpha(img: np.ndarray) -> np.ndarray:
    """
    Removes the alpha channel from an image if it is not used.
    """
    if get_h_w_c(img)[2] != 4:
        return img

    unnecessary = (
        (img.dtype == np.uint8 and np.all(img[:, :, 3] == 255))
        or (img.dtype == np.uint16 and np.all(img[:, :, 3] == 65536))
        or (img.dtype == np.float32 and np.all(img[:, :, 3] == 1.0))
        or (img.dtype == np.float64 and np.all(img[:, :, 3] == 1.0))
    )

    if unnecessary:
        return img[:, :, :3]
    return img


def _read_cv(path: Path) -> tuple[np.ndarray, dict[str, str | int | float]] | None:
    if get_ext(path) not in get_opencv_formats():
        # not supported
        return None

    img = None
    try:
        img = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
    except Exception as cv_err:
        logger.warning("Error loading image, trying with imdecode: %s", cv_err)

    if img is None:
        try:
            img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        except Exception as e:
            raise RuntimeError(
                f'Error reading image image from path "{path}". Image may be corrupt.'
            ) from e

    if img is None:  # type: ignore
        raise RuntimeError(
            f'Error reading image image from path "{path}". Image may be corrupt.'
        )

    # OpenCV doesn't provide easy access to metadata, so return empty dict
    return img, {}


def _read_pil(path: Path) -> tuple[np.ndarray, dict[str, str | int | float]] | None:
    if get_ext(path) not in get_pil_formats():
        # not supported
        return None

    im = Image.open(path)

    # Extract metadata from PIL image
    metadata: dict[str, str | int | float] = {}

    # Get EXIF data if available
    try:
        exif = im.getexif()
        if exif:
            for tag_id, value in exif.items():
                # Convert value to string or number
                if isinstance(value, (int, float)):
                    metadata[f"exif_{tag_id}"] = value
                elif isinstance(value, (str, bytes)):
                    try:
                        metadata[f"exif_{tag_id}"] = str(value)
                    except Exception:
                        pass  # Skip values that can't be converted
    except Exception:
        pass  # EXIF not available or error reading it

    # Get general info
    if hasattr(im, "info") and im.info:
        for key, value in im.info.items():
            if isinstance(value, (int, float)):
                metadata[key] = value
            elif isinstance(value, (str, bytes)):
                try:
                    metadata[key] = str(value)
                except Exception:
                    pass

    if im.mode == "P":
        # convert color palette to actual colors
        im = im.convert(im.palette.mode)

    img = np.array(im)
    _, _, c = get_h_w_c(img)
    if c == 3:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    elif c == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGRA)
    return img, metadata


def _read_dds(path: Path) -> tuple[np.ndarray, dict[str, str | int | float]] | None:
    if get_ext(path) != ".dds":
        # not supported
        return None

    if platform.system() != "Windows":
        # texconv is only supported on Windows.
        return None

    png = dds_to_png_texconv(path)
    try:
        result = _read_cv(png)
        if result is not None:
            img, metadata = result
            img = remove_unnecessary_alpha(img)
            return img, metadata
        return None
    finally:
        os.remove(png)


def _for_ext(ext: str | Iterable[str], decoder: _Decoder) -> _Decoder:
    ext_set: set[str] = set()
    if isinstance(ext, str):
        ext_set.add(ext)
    else:
        ext_set.update(ext)

    return lambda path: decoder(path) if get_ext(path) in ext_set else None


_decoders: list[tuple[str, _Decoder]] = [
    ("pil-jpeg", _for_ext([".jpg", ".jpeg"], _read_pil)),
    ("cv", _read_cv),
    ("texconv-dds", _read_dds),
    ("pil", _read_pil),
]

valid_formats = get_available_image_formats()


@io_group.register(
    schema_id="chainner:image:load",
    name="Load Image",
    description=(
        "Load image from specified file. This node will output the loaded image, the"
        " directory of the image file, the name of the image file (without file"
        " extension), and any metadata embedded in the image file."
    ),
    icon="BsFillImageFill",
    inputs=[
        ImageFileInput(primary_input=True).with_docs(
            "Select the path of an image file."
        )
    ],
    outputs=[
        LargeImageOutput()
        .with_docs(
            "The node will display a preview of the selected image as well as type"
            " information for it. Connect this output to the input of another node to"
            " pass the image to it."
        )
        .suggest(),
        DirectoryOutput("Directory", of_input=0),
        FileNameOutput("Name", of_input=0),
        DictOutput("Metadata").with_docs(
            "Image metadata extracted from the file (e.g., EXIF data). "
            "This will be an empty dictionary if no metadata is available."
        ),
    ],
    side_effects=True,
)
def load_image_node(
    path: Path,
) -> tuple[np.ndarray, Path, str, dict[str, str | int | float]]:
    logger.debug("Reading image from path: %s", path)

    dirname, basename, _ = split_file_path(path)

    img = None
    metadata: dict[str, str | int | float] = {}
    error = None
    for name, decoder in _decoders:
        try:
            result = decoder(Path(path))
            if result is not None:
                img, metadata = result
        except Exception as e:
            error = e
            logger.warning("Decoder %s failed", name)

        if img is not None:
            break

    if img is None:
        if error is not None:
            raise error
        raise RuntimeError(
            f'The image "{path}" you are trying to read cannot be read by chaiNNer.'
        )

    return img, dirname, basename, metadata
