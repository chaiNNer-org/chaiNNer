import os
import sys
import subprocess
import uuid

from sanic.log import logger

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


def dds_to_png_texconv(path: str) -> str:
    """
    Converts the given DDS file to PNG by creating a temporary PNG file.
    """
    prefix = uuid.uuid4().hex
    _, basename = os.path.split(os.path.splitext(path)[0])

    result = subprocess.run(
        [
            __TEXCONV_EXE,
            "-nologo",
            "-ft",
            "png",
            "-px",
            prefix,
            "-o",
            __TEXCONV_DIR,
            path,
        ],
        check=False,
        capture_output=True,
    )

    if result.returncode != 0:
        output = (__decode(result.stdout) + __decode(result.stderr)).replace("\r", "")
        logger.error(
            "\n".join(
                [
                    f"Failed to convert '{path}' to PNG.",
                    f"texconv: {__TEXCONV_EXE}",
                    f"exit code: {result.returncode}",
                    f"output: {output}",
                ]
            )
        )
        raise ValueError(f"Unable to convert DDS: Code {result.returncode}: {output}")

    return os.path.join(__TEXCONV_DIR, prefix + basename + ".png")
