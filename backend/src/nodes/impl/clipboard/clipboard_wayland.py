import shutil
import subprocess

import numpy as np

from .clipboard_base import ClipboardBase


class WaylandClipboard(ClipboardBase):
    def __init__(self) -> None:
        self.wl_copy = shutil.which("wl-copy")
        if not self.wl_copy:
            raise ModuleNotFoundError(
                "wl-copy must be installed. "
                "Please install wl-copy using your system package manager"
            )

    def copy_image(self, image_bytes: bytes, image_array: np.ndarray) -> None:
        proc = subprocess.Popen(
            args=[str(self.wl_copy), "-selection", "clipboard", "-t", "image/png"],
            stdin=subprocess.PIPE,
        )

        stdout, stderr = proc.communicate(image_bytes)
        if proc.returncode != 0:
            raise RuntimeError(
                f"Copy failed. wl_copy returned code: {proc.returncode!r} "
                f"Stderr: {stderr!r} "
                f"Stdout: {stdout!r}"
            )

    def copy_text(self, text: str) -> None:
        proc = subprocess.Popen(
            args=[str(self.wl_copy), "-selection", "clipboard"],
            stdin=subprocess.PIPE,
        )

        stdout, stderr = proc.communicate(text.encode("utf-8"))
        if proc.returncode != 0:
            raise RuntimeError(
                f"Copy failed. wl_copy returned code: {proc.returncode!r} "
                f"Stderr: {stderr!r} "
                f"Stdout: {stdout!r}"
            )
