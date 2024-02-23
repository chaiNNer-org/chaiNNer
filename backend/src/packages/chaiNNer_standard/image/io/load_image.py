from __future__ import annotations

import os
import platform
from pathlib import Path
from typing import Callable, Iterable, Union

import cv2
import numpy as np
from PIL import Image
from sanic.log import logger

from nodes.impl.dds.texconv import dds_to_png_texconv
from nodes.impl.image_formats import (
    get_available_image_formats,
    get_opencv_formats,
    get_pil_formats,
)
from nodes.properties.inputs import ImageFileInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput, LargeImageOutput
from nodes.utils.utils import get_h_w_c, split_file_path

from .. import io_group

_Decoder = Callable[[Path], Union[np.ndarray, None]]
"""
图像解码器。

如果给定的图像格式自然不受支持，则解码器可能返回 `None` 而不是引发异常。
例如，当文件扩展名指示不支持的格式时。
"""


def get_ext(path: Path | str) -> str:
    return split_file_path(path)[2].lower()


def remove_unnecessary_alpha(img: np.ndarray) -> np.ndarray:
    """
    如果不使用alpha通道，则将其从图像中删除。
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


def _read_cv(path: Path) -> np.ndarray | None:
    if get_ext(path) not in get_opencv_formats():
        # not supported
        return None

    img = None
    try:
        img = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
    except Exception as cv_err:
        logger.warning(f"加载图像时出错，尝试使用 imdecode: {cv_err}")

    if img is None:
        try:
            img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        except Exception as e:
            raise RuntimeError(
                f'从路径“{path}”读取图像图像时出错。图像可能已损坏。'
            ) from e

    if img is None:  # type: ignore
        raise RuntimeError(
            f'从路径“{path}”读取图像图像时出错。图像可能已损坏。'
        )

    return img


def _read_pil(path: Path) -> np.ndarray | None:
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


def _read_dds(path: Path) -> np.ndarray | None:
    if get_ext(path) != ".dds":
        # not supported
        return None

    if platform.system() != "Windows":
        # texconv is only supported on Windows.
        return None

    png = dds_to_png_texconv(path)
    try:
        img = _read_cv(png)
        if img is not None:
            img = remove_unnecessary_alpha(img)
        return img
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
    name="加载图像",
    description=(
        "从指定的文件加载图像。此节点将输出加载的图像"
        "图像文件的目录，以及图像文件的名称（不带文件扩展名）。"
    ),
    icon="BsFillImageFill",
    inputs=[
        ImageFileInput(primary_input=True).with_docs(
            "选择图像文件的路径。"
        )
    ],
    outputs=[
        LargeImageOutput().with_docs(
            "该节点将显示所选图像的预览及其类型信息。将此输出连接到另一个节点的输入以将图像传递给它。"
        ),
        DirectoryOutput("目录", of_input=0),
        FileNameOutput("名称", of_input=0),
    ],
)
def load_image_node(path: Path) -> tuple[np.ndarray, Path, str]:
    logger.debug(f"正在从路径读取图像: {path}")

    dirname, basename, _ = split_file_path(path)

    img = None
    error = None
    for name, decoder in _decoders:
        try:
            img = decoder(Path(path))
        except Exception as e:
            error = e
            logger.warning(f"解码器｛name｝失败")

        if img is not None:
            break

    if img is None:
        if error is not None:
            raise error
        raise RuntimeError(
            f'chaiNNer 无法读取您尝试读取的图像“{path}”。'
        )

    return img, dirname, basename
