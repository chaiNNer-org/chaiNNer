import numpy as np
import win32clipboard

from .clipboard_base import ClipboardBase

PNG_FORMAT = 49472


class WindowsClipboard(ClipboardBase):
    def __init__(self) -> None:
        if win32clipboard is None:
            raise Exception(
                "pywin32 must be installed to use this library on Windows platform."
            )

    def copy_image(self, img: bytes) -> None:
        win32clipboard.OpenClipboard()
        win32clipboard.EmptyClipboard()
        win32clipboard.SetClipboardData(PNG_FORMAT, img)  # type: ignore
        win32clipboard.CloseClipboard()
