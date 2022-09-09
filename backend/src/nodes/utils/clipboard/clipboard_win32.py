import win32clipboard
import ctypes
import cv2
import numpy as np

from ctypes import wintypes

from nodes.utils.utils import get_h_w_c
from .clipboard_base import ClipboardBase


class COMPRESSION_ENUMERATION:
    BI_RGB = 0x0000
    BI_RLE8 = 0x0001
    BI_RLE4 = 0x0002
    BI_BITFIELDS = 0x0003
    BI_JPEG = 0x0004
    BI_PNG = 0x0005
    BI_CMYK = 0x000B
    BI_CMYKRLE8 = 0x000C
    BI_CMYKRLE4 = 0x000D


class RGBQUAD(ctypes.Structure):
    _fields_ = [
        ("rgbRed", ctypes.c_byte),
        ("rgbGreen", ctypes.c_byte),
        ("rgbBlue", ctypes.c_byte),
        ("rgbReserved", ctypes.c_byte),
    ]


class CIEXYZ(ctypes.Structure):
    _fields_ = [
        ("ciexyzX", wintypes.DWORD),
        ("ciexyzY", wintypes.DWORD),
        ("ciexyzZ", wintypes.DWORD),
    ]
    __slots__ = [f[0] for f in _fields_]


class CIEXYZTRIPLE(ctypes.Structure):
    _fields_ = [
        ("ciexyzRed", CIEXYZ),
        ("ciexyzBlue", CIEXYZ),
        ("ciexyzGreen", CIEXYZ),
    ]
    __slots__ = [f[0] for f in _fields_]


class BITMAPV5HEADER(ctypes.Structure):
    _fields_ = [
        ("bV5Size", wintypes.DWORD),
        ("bV5Width", wintypes.LONG),
        ("bV5Height", wintypes.LONG),
        ("bV5Planes", wintypes.WORD),
        ("bV5BitCount", wintypes.WORD),
        ("bV5Compression", wintypes.DWORD),
        ("bV5SizeImage", wintypes.DWORD),
        ("bV5XPelsPerMeter", wintypes.LONG),
        ("bV5YPelsPerMeter", wintypes.LONG),
        ("bV5ClrUsed", wintypes.DWORD),
        ("bV5ClrImportant", wintypes.DWORD),
        ("bV5RedMask", wintypes.DWORD),
        ("bV5GreenMask", wintypes.DWORD),
        ("bV5BlueMask", wintypes.DWORD),
        ("bV5AlphaMask", wintypes.DWORD),
        ("bV5CSType", wintypes.DWORD),
        ("bV5Endpoints", CIEXYZTRIPLE),
        ("bV5GammaRed", wintypes.DWORD),
        ("bV5GammaGreen", wintypes.DWORD),
        ("bV5GammaBlue", wintypes.DWORD),
        ("bV5Intent", wintypes.DWORD),
        ("bV5ProfileData", wintypes.DWORD),
        ("bV5ProfileSize", wintypes.DWORD),
        ("bV5Reserved", wintypes.DWORD),
    ]


class WindowsClipboard(ClipboardBase):
    def __init__(self) -> None:

        self.__PNG_FORMAT = win32clipboard.RegisterClipboardFormat("PNG")  # type: ignore
        self.__DIPV5_FORMAT = 17

        if win32clipboard is None:
            raise Exception(
                "pywin32 must be installed to use this library on Windows platform."
            )

    def __generate_dibv5(self, image_array: np.ndarray):
        image_height, image_width, image_channel_count = get_h_w_c(image_array)

        img_pixel_size = image_height * image_width

        class BITMAPINFO(ctypes.Structure):
            _fields_ = [
                ("bmiHeader", BITMAPV5HEADER),
                ("bmiColors", ctypes.c_byte * (4 * img_pixel_size)),
            ]

        dipv5 = BITMAPINFO()
        dipv5.bmiHeader.bV5Size = ctypes.sizeof(BITMAPV5HEADER)
        dipv5.bmiHeader.bV5Width = image_width
        dipv5.bmiHeader.bV5Height = image_height
        dipv5.bmiHeader.bV5Planes = 1
        dipv5.bmiHeader.bV5BitCount = 32
        dipv5.bmiHeader.bV5Compression = COMPRESSION_ENUMERATION.BI_RGB
        dipv5.bmiHeader.bV5SizeImage = 0

        if image_channel_count == 3:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2RGBA)

        image_array = cv2.flip(image_array, 0)
        colors = (
            image_array.flatten()
            .ctypes.data_as(ctypes.POINTER(ctypes.c_byte * (4 * img_pixel_size)))
            .contents
        )

        dipv5.bmiColors = colors

        return dipv5

    def copy_image(self, image_bytes: bytes, image_array: np.ndarray) -> None:
        try:
            win32clipboard.OpenClipboard()
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardData(self.__PNG_FORMAT, image_bytes)  # type: ignore
            dipv5 = self.__generate_dibv5(image_array)
            win32clipboard.SetClipboardData(self.__DIPV5_FORMAT, dipv5)  # type: ignore
            win32clipboard.CloseClipboard()
        except Exception as err:
            win32clipboard.CloseClipboard()
            raise err
