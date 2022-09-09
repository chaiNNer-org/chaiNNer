import pasteboard
import numpy as np

from .clipboard_base import ClipboardBase


class DarwinClipboard(ClipboardBase):
    def __init__(self) -> None:
        self.pb = pasteboard.Pasteboard()

    def copy_image(self, image_bytes: bytes, image_array: np.ndarray) -> None:
        self.pb.set_contents(image_bytes, pasteboard.PNG)
