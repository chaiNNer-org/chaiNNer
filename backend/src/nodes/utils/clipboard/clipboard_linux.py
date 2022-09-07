import numpy as np
import shutil
import subprocess

from .clipboard_base import ClipboardBase

class LinuxClipboard(ClipboardBase):
    def __init__(self) -> None:
        self.xclip = shutil.which('xclip')
        if not self.xclip:
            raise Exception("xclip must be installed. " "Please install xclip using your system package manager")

    def copy_image(self, img: bytes) -> None:
        proc = subprocess.Popen(
            args=[str(self.xclip), '-selection', 'clipboard', '-t', 'image/png'],
            stdin=subprocess.PIPE,
        )

        stdout, stderr = proc.communicate(img)
        if proc.returncode != 0:
            raise Exception(
                f"Copy failed. xclip returned code: {proc.returncode!r} "
                f"Stderr: {stderr!r} "
                f"Stdout: {stdout!r}"
            )