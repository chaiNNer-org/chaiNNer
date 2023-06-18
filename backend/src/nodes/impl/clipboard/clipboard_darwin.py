import sys
from typing import Any

import numpy as np

from .clipboard_base import ClipboardBase

# Check if we are running on macOS, because pasteboard is only available on macOS
if sys.platform == "darwin":
    try:
        import pasteboard
    except:
        pasteboard = None
else:
    pasteboard = None


class DarwinClipboard(ClipboardBase):
    def __init__(self) -> None:
        if pasteboard is None:
            raise ModuleNotFoundError("Pasteboard is not available.")

        self.pb: Any = pasteboard.Pasteboard()

    def copy_image(self, image_bytes: bytes, image_array: np.ndarray) -> None:
        if self.pb is None or pasteboard is None:
            raise ModuleNotFoundError("Pasteboard is not available.")

        self.pb.set_contents(image_bytes, pasteboard.PNG)

    def copy_text(self, text: str) -> None:
        if self.pb is None or pasteboard is None:
            raise ModuleNotFoundError("Pasteboard is not available.")

        self.pb.set_contents(text)
