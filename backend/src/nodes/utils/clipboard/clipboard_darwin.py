import numpy as np
import shutil
import subprocess

from .clipboard_base import ClipboardBase

class DarwinClipboard(ClipboardBase):
    def __init__(self) -> None:
        pass

    def copy_image(self, img: bytes) -> None:
        pass