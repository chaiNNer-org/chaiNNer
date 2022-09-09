import pasteboard

from .clipboard_base import ClipboardBase


class DarwinClipboard(ClipboardBase):
    def __init__(self) -> None:
        self.pb = pasteboard.Pasteboard()

    def copy_image(self, imageBytes: bytes) -> None:
        self.pb.set_contents(imageBytes, pasteboard.PNG)
