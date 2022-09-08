import numpy as np
import shutil
import subprocess

from .clipboard_base import ClipboardBase

class DarwinClipboard(ClipboardBase):
    def __init__(self) -> None:
        self.pbcopy = shutil.which('pbcopy')
        if not self.pbcopy:
            raise Exception("pbcopy not found. pbcopy must be installed and available on PATH")

    def copy_image(self, img: bytes) -> None:
        if self.pbcopy is None:
            raise Exception("pbcopy not found. pbcopy must be installed and available on PATH")

        process_args = [self.pbcopy]
        proc = subprocess.Popen(process_args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = proc.communicate(img)
        if proc.returncode != 0:
            raise Exception(f"Copy failed. pbcopy returned code: {proc.returncode!r} "
                                     f"Stderr: {stderr!r} "
                                     f"Stdout: {stdout!r}")