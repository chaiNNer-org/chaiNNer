import shutil
import subprocess

from PIL import Image
from .clipboard_base import ClipboardBase


class WaylandClipboard(ClipboardBase):
    def __init__(self) -> None:
        self.wl_copy = shutil.which("wl-copy")
        if not self.wl_copy:
            raise Exception(
                "wl-copy must be installed. "
                "Please install wl-copy using your system package manager"
            )

    def copy_image(self, imageBytes: bytes, image: Image.Image) -> None:
        proc = subprocess.Popen(
            args=[str(self.wl_copy), "-selection", "clipboard", "-t", "image/png"],
            stdin=subprocess.PIPE,
        )

        stdout, stderr = proc.communicate(imageBytes)
        if proc.returncode != 0:
            raise Exception(
                f"Copy failed. wl_copy returned code: {proc.returncode!r} "
                f"Stderr: {stderr!r} "
                f"Stdout: {stdout!r}"
            )
