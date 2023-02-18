import os
import sys

import numpy as np
from sanic.log import logger

from .clipboard_base import ClipboardBase

ERROR = None
DEFAULT_CLIPBOARD = None
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
        raise NotImplementedError("No suitable clipboard found.")
except Exception as e:
    DEFAULT_CLIPBOARD = None
    ERROR = e
    logger.error(f"{e}\nClipboard functionality will be disabled.")


def copy_image(imageArray: np.ndarray):
    if DEFAULT_CLIPBOARD is None:
        logger.error(ERROR)
        raise NotImplementedError(ERROR)

    try:
        image_bytes, fixed_image_array = ClipboardBase.prepare_image(imageArray)
        DEFAULT_CLIPBOARD.copy_image(image_bytes, fixed_image_array)
    except Exception as err:
        logger.error(err)
        raise err


def copy_text(text: str):
    if DEFAULT_CLIPBOARD is None:
        logger.error(ERROR)
        raise NotImplementedError(ERROR)

    try:
        DEFAULT_CLIPBOARD.copy_text(text)
    except Exception as err:
        logger.error(err)
        raise err
