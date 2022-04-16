def get_opencv_formats():
    available_formats = []
    try:
        import cv2

        # Bitmaps
        available_formats.extend([".bmp", ".dib"])

        # JPEG
        available_formats.extend([".jpg", ".jpeg", ".jpe", ".jp2"])

        # PNG, WebP, Tiff
        available_formats.extend([".png", ".webp", ".tiff"])

        # Portable image format
        available_formats.extend([".pbm", ".pgm", ".ppm", ".pxm", ".pnm"])

        # Sun Rasters
        available_formats.extend([".sr", ".ras"])

        # OpenEXR
        available_formats.extend([".exr"])

        # Radiance HDR
        available_formats.extend([".hdr", ".pic"])
    except:
        print("OpenCV not installed")
    return available_formats


def get_pil_formats():
    available_formats = []
    try:
        from PIL import Image

        # Bitmaps
        available_formats.extend([".bmp", ".dib", ".xbm"])

        # DDS
        available_formats.extend([".dds"])

        # EPS
        available_formats.extend([".eps"])

        # GIF
        # available_formats.extend([".gif"])

        # Icons
        available_formats.extend([".icns", ".ico"])

        # JPEG
        available_formats.extend([".jpg", ".jpeg", ".jfif", ".jp2", ".jpx"])

        # Randoms
        available_formats.extend([".msp", ".pcx", ".sgi"])

        # PNG, WebP, TIFF
        available_formats.extend([".png", ".webp", ".tiff"])

        # APNG
        # available_formats.extend([".apng"])

        # Portable image format
        available_formats.extend([".pbm", ".pgm", ".ppm", ".pnm"])

        # TGA
        available_formats.extend([".tga"])
    except:
        print("Pillow not installed")
    return available_formats


def get_available_image_formats():
    available_formats = []
    available_formats.extend(get_opencv_formats())
    available_formats.extend(get_pil_formats())
    no_dupes = set(available_formats)
    return sorted(list(no_dupes))
