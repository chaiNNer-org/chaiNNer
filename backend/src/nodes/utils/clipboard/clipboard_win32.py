import numpy as np
import win32clipboard 

from .clipboard_base import ClipboardBase

class WindowsClipboard(ClipboardBase):
    def __init__(self) -> None:
        if win32clipboard is None:
            raise Exception("pywin32 must be installed to use this library on Windows platform.")

    def copy_image(self, img: bytes) -> None:
        win32clipboard.OpenClipboard()
        win32clipboard.EmptyClipboard()
        win32clipboard.SetClipboardData(49472, img)  # type: ignore # 49472 -> PNG format
        win32clipboard.CloseClipboard()