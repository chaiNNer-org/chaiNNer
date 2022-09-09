import sys
import os
import numpy as np
from sanic.log import logger

from .clipboard_base import ClipboardBase

try:
    if sys.platform == "win32":
        from .clipboard_win32 import WindowsClipboard

        DEFAULT_CLIPBOARD = WindowsClipboard()
    elif sys.platform == "linux" and os.environ.get("WAYLAND_DISPLAY"):
        from .clipboard_wayland import WaylandClipboard

        DEFAULT_CLIPBOARD = WaylandClipboard()
    elif sys.platform == "linux":
        from .clipboard_linux import LinuxClipboard

        DEFAULT_CLIPBOARD = LinuxClipboard()
    elif sys.platform == "darwin":
        from .clipboard_darwin import DarwinClipboard

        DEFAULT_CLIPBOARD = DarwinClipboard()
    else:
        raise Exception("No suitable clipboard found.")
except Exception as e:
    DEFAULT_CLIPBOARD = None
    logger.error(e)


def copy_image(imageArray: np.ndarray):
    if DEFAULT_CLIPBOARD is None:
        error = f"Cant clipboard image!\nNo suitable clipboard found."
        logger.error(error)
        raise Exception(error)
        
    try:
        imageBytes, image = ClipboardBase.prepare_image(imageArray)
        DEFAULT_CLIPBOARD.copy_image(imageBytes, image)
    except Exception as err:
        logger.error(err)
        raise err
