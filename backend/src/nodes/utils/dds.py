import os
import sys
import subprocess
import uuid
from tempfile import mkdtemp
from typing import List
import shutil
import platform

import numpy as np

from sanic.log import logger

from .image_utils import cv_save_image

__TEXCONV_DIR = os.path.join(
    os.path.dirname(sys.modules["__main__"].__file__), "texconv"  # type: ignore
)
__TEXCONV_EXE = os.path.join(__TEXCONV_DIR, "texconv.exe")


def __decode(b: bytes) -> str:
    try:
        return b.decode(encoding="iso8859-1")
    except:
        try:
            return b.decode(encoding="utf-8")
        except:
            return str(b)


def __run_texconv(args: List[str], error_message: str):
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
                    f"Failed to run texconv.",
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
    _, basename = os.path.split(os.path.splitext(path)[0])

    tempdir = mkdtemp(prefix="chaiNNer-")

    __run_texconv(
        [
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


__SRGB_DDS_FORMATS = {
    "BC1_UNORM_SRGB",
    "BC2_UNORM_SRGB",
    "BC3_UNORM_SRGB",
    "BC7_UNORM_SRGB",
    "B8G8R8A8_UNORM_SRGB",
    "B8G8R8X8_UNORM_SRGB",
    "R8G8B8A8_UNORM_SRGB",
}


def save_as_dds(
    path: str,
    image: np.ndarray,
    dds_format: str,
    mipmap_levels: int = 0,
    uniform_weighting: bool = False,
    dithering: bool = False,
    minimal_compression: bool = False,
    maximum_compression: bool = False,
):
    """
    Saves an image as DDS using texconv.
    See the following page for more information on save options:
    https://github.com/Microsoft/DirectXTex/wiki/Texconv
    """
    tempDir = mkdtemp(prefix="chaiNNer-")

    try:
        tempName = uuid.uuid4().hex
        tempPng = os.path.join(tempDir, f"{tempName}.png")
        cv_save_image(tempPng, image, [])

        args = ["-f", dds_format, "-dx10", "-m", str(mipmap_levels), "-o", tempDir]

        bc = ""
        bc += "u" if uniform_weighting else ""
        bc += "d" if dithering else ""
        bc += "q" if minimal_compression else ""
        bc += "x" if maximum_compression else ""
        if bc:
            args.extend(["-bc", f"-{bc}"])

        if dds_format in __SRGB_DDS_FORMATS:
            args.append("-srgbi")

        args.append(tempPng)
        __run_texconv(args, "Unable to write DDS")

        tempDds = os.path.join(tempDir, f"{tempName}.dds")

        # delete existing file
        try:
            os.remove(path)
        except:
            pass

        os.rename(tempDds, path)
    finally:
        shutil.rmtree(tempDir)
