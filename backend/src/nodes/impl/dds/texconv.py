from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
import uuid
from tempfile import mkdtemp

import numpy as np
from sanic.log import logger

from ...utils.utils import split_file_path
from ..image_utils import cv_save_image
from .format import SRGB_FORMATS, DxgiFormat

__TEXCONV_DIR = os.path.join(
    os.path.dirname(sys.modules["__main__"].__file__),  # type: ignore
    "texconv",  # type: ignore
)
__TEXCONV_EXE = os.path.join(__TEXCONV_DIR, "texconv.exe")


def __decode(b: bytes) -> str:
    try:
        return b.decode(encoding="iso8859-1")
    except Exception:
        try:
            return b.decode(encoding="utf-8")
        except Exception:
            return str(b)


def __run_texconv(args: list[str], error_message: str):
    if platform.system() != "Windows":
        # texconv is only supported on Windows.
        raise ValueError(
            "Texconv is only supported on Windows."
            " Reading and writing DDS files is only partially supported on other systems."
        )

    result = subprocess.run(
        [__TEXCONV_EXE, "-nologo", *args],
        check=False,
        capture_output=True,
    )

    if result.returncode != 0:
        output = (__decode(result.stdout) + __decode(result.stderr)).replace("\r", "")
        logger.error(
            "\n".join(
                [
                    "Failed to run texconv.",
                    f"texconv: {__TEXCONV_EXE}",
                    f"args: {args}",
                    f"exit code: {result.returncode}",
                    f"output: {output}",
                ]
            )
        )
        raise ValueError(f"{error_message}: Code {result.returncode}: {output}")


def dds_to_png_texconv(path: str) -> str:
    """
    Converts the given DDS file to PNG by creating a temporary PNG file.
    """
    prefix = uuid.uuid4().hex
    _, basename, _ = split_file_path(path)

    tempdir = mkdtemp(prefix="chaiNNer-")

    __run_texconv(
        [
            "-f",
            "rgba",
            "-srgb",
            "-ft",
            "png",
            "-px",
            prefix,
            "-o",
            tempdir,
            path,
        ],
        "Unable to convert DDS",
    )

    return os.path.join(tempdir, prefix + basename + ".png")


def save_as_dds(
    path: str,
    image: np.ndarray,
    dds_format: DxgiFormat,
    mipmap_levels: int = 0,
    uniform_weighting: bool = False,
    dithering: bool = False,
    minimal_compression: bool = False,
    maximum_compression: bool = False,
    dx9: bool = False,
    separate_alpha: bool = False,
):
    """
    Saves an image as DDS using texconv.
    See the following page for more information on save options:
    https://github.com/Microsoft/DirectXTex/wiki/Texconv
    """
    target_dir, name, ext = split_file_path(path)

    if ext != ".dds":
        raise ValueError("The file to save must end with '.dds'")

    temp_dir = mkdtemp(prefix="chaiNNer-")

    try:
        temp_png = os.path.join(temp_dir, f"{name}.png")
        cv_save_image(temp_png, image, [])

        args = [
            "-y",
            "-f",
            dds_format,
            "-dx9" if dx9 else "-dx10",
            "-m",
            str(mipmap_levels),
            # use texconv to directly produce the target file
            "-o",
            target_dir,
        ]

        bc = ""
        bc += "u" if uniform_weighting else ""
        bc += "d" if dithering else ""
        bc += "q" if minimal_compression else ""
        bc += "x" if maximum_compression else ""
        if bc:
            args.extend(["-bc", f"-{bc}"])

        if dds_format in SRGB_FORMATS:
            args.append("-srgbi")

        if separate_alpha:
            args.append("-sepalpha")

        args.append(temp_png)
        __run_texconv(args, "Unable to write DDS")
    finally:
        shutil.rmtree(temp_dir)
