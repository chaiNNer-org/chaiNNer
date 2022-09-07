import io
import os
import sys
import cv2
import numpy as np

from .utils import get_h_w_c
from PIL import Image

import win32clipboard 
import shutil
import subprocess

xclip = shutil.which('xclip')
wl_copy = shutil.which('wl-copy')
if sys.platform == 'linux':
    if not xclip and not os.environ.get("WAYLAND_DISPLAY"):
        raise Exception(
            "xclip must be installed. " "Please install xclip using your system package manager"
            )
    elif not wl_copy and os.environ.get("WAYLAND_DISPLAY"):
        raise Exception(
            "wl-copy must be installed. " "Please install wl-copy using your system package manager"
            )


class Clipboard:
    @staticmethod
    def __win_copy(img: bytes):
        win32clipboard.OpenClipboard()
        win32clipboard.EmptyClipboard()
        win32clipboard.SetClipboardData(49472, img)  # type: ignore # 49472 -> PNG format
        win32clipboard.CloseClipboard()

    @staticmethod
    def __linux_copy(img: bytes):
        proc = subprocess.Popen(
            args=[str(xclip), '-selection', 'clipboard', '-t', 'image/png'],
            stdin=subprocess.PIPE,
        )

        stdout, stderr = proc.communicate(img)
        if proc.returncode != 0:
            raise Exception(
                f"Copy failed. xclip returned code: {proc.returncode!r} "
                f"Stderr: {stderr!r} "
                f"Stdout: {stdout!r}"
            )

    @staticmethod
    def __wayland_copy(img: bytes):
        proc = subprocess.Popen(
            args=[str(wl_copy), '-selection', 'clipboard', '-t', 'image/png'],
            stdin=subprocess.PIPE,
        )

        stdout, stderr = proc.communicate(img)
        if proc.returncode != 0:
            raise Exception(
                f"Copy failed. wl_copy returned code: {proc.returncode!r} "
                f"Stderr: {stderr!r} "
                f"Stdout: {stdout!r}"
            )

    @staticmethod
    def __darwin_copy(img: bytes):
        pass

    @staticmethod
    def __copy_to_clipboard(img: bytes):
        if sys.platform == 'win32':
            Clipboard.__win_copy(img)
        elif sys.platform == 'linux' and os.environ.get("WAYLAND_DISPLAY"):
            Clipboard.__wayland_copy(img)
        elif sys.platform == 'linux':
            Clipboard.__wayland_copy(img)
        elif sys.platform == 'darwin':
            Clipboard.__darwin_copy(img)
        else:
            raise Exception("No suitable clipboard found.")

    @staticmethod
    def __prepare_image(img: np.ndarray):
        img = (np.clip(img, 0, 1) * 255).round().astype("uint8")

        _, _, c = get_h_w_c(img)
        if c == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        elif c == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA)

        data = Image.fromarray(img)

        imgBytes = io.BytesIO()
        data.save(imgBytes, format="png")

        return imgBytes.getvalue()

    @staticmethod
    def copy_image(img: np.ndarray):
        bytes = Clipboard.__prepare_image(img)
        Clipboard.__copy_to_clipboard(bytes)