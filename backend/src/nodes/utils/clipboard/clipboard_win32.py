import win32clipboard
import ctypes

from PIL import Image
import requests
from io import BytesIO
from sanic.log import logger
from ctypes import wintypes
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

    def __generate_dibv5(self, image: Image.Image):
        img_pixel_size = image.width * image.height

        class BITMAPINFO(ctypes.Structure):
            _fields_ = [
                ("bmiHeader", BITMAPV5HEADER),
                ("bmiColors", RGBQUAD * img_pixel_size),
            ]

        dipv5 = BITMAPINFO()
        dipv5.bmiHeader.bV5Size = ctypes.sizeof(BITMAPV5HEADER)
        dipv5.bmiHeader.bV5Width = image.width
        dipv5.bmiHeader.bV5Height = image.height
        dipv5.bmiHeader.bV5Planes = 1
        dipv5.bmiHeader.bV5BitCount = 32
        dipv5.bmiHeader.bV5Compression = COMPRESSION_ENUMERATION.BI_RGB
        dipv5.bmiHeader.bV5SizeImage = 0

        colors = ((RGBQUAD) * img_pixel_size)()
        channel_count = len(image.getbands())

        for y in range(image.height):
            for x in range(image.width):
                i = (
                    (image.height - y - 1) * image.width + x
                ) - 1  # Flip the image upside down

                if channel_count == 3:
                    b, g, r = image.getpixel((x, y))
                    colors[i].rgbRed = r
                    colors[i].rgbGreen = g
                    colors[i].rgbBlue = b
                    colors[i].rgbReserved = 0
                elif channel_count == 4:
                    b, g, r, a = image.getpixel((x, y))
                    colors[i].rgbRed = r
                    colors[i].rgbGreen = g
                    colors[i].rgbBlue = b
                    colors[i].rgbReserved = a # Not technically an alpha channel, but most applications use this as the alpha channel

        dipv5.bmiColors = colors

        return dipv5

    def copy_image(self, imageBytes: bytes, image: Image.Image) -> None:
        try:
            win32clipboard.OpenClipboard()
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardData(self.__PNG_FORMAT, imageBytes)  # type: ignore
            dipv5 = self.__generate_dibv5(image)
            win32clipboard.SetClipboardData(self.__DIPV5_FORMAT, dipv5)  # type: ignore
            win32clipboard.CloseClipboard()
        except Exception as err:
            win32clipboard.CloseClipboard()
            raise err
