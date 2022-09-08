import numpy as np
import pasteboard

from .clipboard_base import ClipboardBase


class DarwinClipboard(ClipboardBase):
    def __init__(self) -> None:
        self.pb = pasteboard.Pasteboard()

    def copy_image(self, img: bytes) -> None:
        self.pb.set_contents(img, pasteboard.PNG)
