import win32clipboard

from .clipboard_base import ClipboardBase

# TODO Implement CF_DIBV5 as a Fallback to PNG; PNG is not supported in every application


class WindowsClipboard(ClipboardBase):
    def __init__(self) -> None:
        self.__PNG_FORMAT = win32clipboard.RegisterClipboardFormat("PNG")  # type: ignore

        if win32clipboard is None:
            raise Exception(
                "pywin32 must be installed to use this library on Windows platform."
            )

    def copy_image(self, imageBytes: bytes) -> None:
        try:
            win32clipboard.OpenClipboard()
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardData(self.__PNG_FORMAT, imageBytes)  # type: ignore
            win32clipboard.CloseClipboard()
        except Exception as err:
            win32clipboard.CloseClipboard()
            raise err
