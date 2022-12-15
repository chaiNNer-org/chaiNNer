def get_opencv_formats():
    return [
        # Bitmaps
        ".bmp",
        ".dib",
        # JPEG
        ".jpg",
        ".jpeg",
        ".jpe",
        ".jp2",
        # PNG, WebP, Tiff
        ".png",
        ".webp",
        ".tif",
        ".tiff",
        # Portable image format
        ".pbm",
        ".pgm",
        ".ppm",
        ".pxm",
        ".pnm",
        # Sun Rasters
        ".sr",
        ".ras",
        # OpenEXR
        ".exr",
        # Radiance HDR
        ".hdr",
        ".pic",
    ]


def get_pil_formats():
    return [
        # Bitmaps
        ".bmp",
        ".dib",
        ".xbm",
        # DDS
        ".dds",
        # EPS
        ".eps",
        # GIF
        # ".gif",
        # Icons
        ".icns",
        ".ico",
        # JPEG
        ".jpg",
        ".jpeg",
        ".jfif",
        ".jp2",
        ".jpx",
        # Randoms
        ".msp",
        ".pcx",
        ".sgi",
        # PNG, WebP, TIFF
        ".png",
        ".webp",
        ".tiff",
        # APNG
        # ".apng",
        # Portable image format
        ".pbm",
        ".pgm",
        ".ppm",
        ".pnm",
        # TGA
        ".tga",
    ]


def get_available_image_formats():
    all_formats = [*get_opencv_formats(), *get_pil_formats()]
    return sorted(list(set(all_formats)))
