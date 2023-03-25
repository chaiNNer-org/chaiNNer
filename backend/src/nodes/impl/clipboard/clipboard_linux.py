import shutil
import subprocess

import numpy as np

from .clipboard_base import ClipboardBase


class LinuxClipboard(ClipboardBase):
    def __init__(self) -> None:
        self.xclip = shutil.which("xclip")
        if not self.xclip:
            raise ModuleNotFoundError(
                "xclip must be installed. "
                "Please install xclip using your system package manager"
            )

    def copy_image(self, image_bytes: bytes, image_array: np.ndarray) -> None:
        proc = subprocess.Popen(
            args=[str(self.xclip), "-selection", "clipboard", "-t", "image/png"],
            stdin=subprocess.PIPE,
        )

        stdout, stderr = proc.communicate(image_bytes)
        if proc.returncode != 0:
            raise RuntimeError(
                f"Copy failed. xclip returned code: {proc.returncode!r} "
                f"Stderr: {stderr!r} "
                f"Stdout: {stdout!r}"
            )

    def copy_text(self, text: str) -> None:
        proc = subprocess.Popen(
            args=[str(self.xclip), "-selection", "clipboard"],
            stdin=subprocess.PIPE,
        )

        stdout, stderr = proc.communicate(text.encode("utf-8"))
        if proc.returncode != 0:
            raise RuntimeError(
                f"Copy failed. xclip returned code: {proc.returncode!r} "
                f"Stderr: {stderr!r} "
                f"Stdout: {stdout!r}"
            )
