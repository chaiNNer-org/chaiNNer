from typing import List, Tuple

import numpy as np
import onnxruntime as ort
from cv2 import (
    BORDER_DEFAULT,
    COLOR_BGR2RGB,
    COLOR_BGRA2RGB,
    COLOR_RGBA2BGRA,
    MORPH_ELLIPSE,
    MORPH_OPEN,
    GaussianBlur,
    cvtColor,
    getStructuringElement,
    morphologyEx,
)
from PIL import Image
from PIL.Image import Image as PILImage
from scipy.ndimage import binary_erosion

from ...impl.image_utils import normalize
from ...utils.utils import get_h_w_c
from .pymatting.estimate_alpha_cf import estimate_alpha_cf
from .pymatting.estimate_foreground_ml import estimate_foreground_ml
from .pymatting.util import stack_images
from .session_factory import new_session

kernel = getStructuringElement(MORPH_ELLIPSE, (3, 3))


def alpha_matting_cutout(
    img: PILImage,
    mask: PILImage,
    foreground_threshold: int,
    background_threshold: int,
    erode_structure_size: int,
) -> PILImage:
    if img.mode in ("RGBA", "CMYK"):
        img = img.convert("RGB")

    npimg = np.asarray(img)
    npmask = np.asarray(mask)

    is_foreground = npmask > foreground_threshold
    is_background = npmask < background_threshold

    structure = None
    if erode_structure_size > 0:
        structure = np.ones(
            (erode_structure_size, erode_structure_size), dtype=np.uint8
        )

    is_foreground = binary_erosion(is_foreground, structure=structure)
    is_background = binary_erosion(is_background, structure=structure, border_value=1)

    trimap = np.full(npmask.shape, dtype=np.uint8, fill_value=128)
    trimap[is_foreground] = 255
    trimap[is_background] = 0

    img_normalized = npimg / 255.0
    trimap_normalized = trimap / 255.0

    alpha = estimate_alpha_cf(img_normalized, trimap_normalized)
    foreground = estimate_foreground_ml(img_normalized, alpha)
    cutout = stack_images(foreground, alpha)

    cutout = np.clip(cutout * 255, 0, 255).astype(np.uint8)  # type: ignore
    cutout = Image.fromarray(cutout)

    return cutout


def naive_cutout(img: PILImage, mask: PILImage) -> PILImage:
    empty = Image.new("RGBA", (img.size), 0)
    cutout = Image.composite(img, empty, mask)
    return cutout


def get_concat_v_multi(imgs: List[PILImage]) -> PILImage:
    pivot = imgs.pop(0)
    for im in imgs:
        pivot = get_concat_v(pivot, im)
    return pivot


def get_concat_v(img1: PILImage, img2: PILImage) -> PILImage:
    dst = Image.new("RGBA", (img1.width, img1.height + img2.height))
    dst.paste(img1, (0, 0))
    dst.paste(img2, (0, img1.height))
    return dst


def post_process(mask: np.ndarray) -> np.ndarray:
    """
    Post Process the mask for a smooth boundary by applying Morphological Operations
    Research based on paper: https://www.sciencedirect.com/science/article/pii/S2352914821000757
    args:
        mask: Binary Numpy Mask
    """
    mask = morphologyEx(mask, MORPH_OPEN, kernel)
    mask = GaussianBlur(mask, (5, 5), sigmaX=2, sigmaY=2, borderType=BORDER_DEFAULT)
    mask = np.where(mask < 127, 0, 255).astype(  # type: ignore
        np.uint8
    )  # convert again to binary
    return mask


def remove_bg(
    img: np.ndarray,
    ort_session: ort.InferenceSession,
    alpha_matting: bool = False,
    alpha_matting_foreground_threshold: int = 240,
    alpha_matting_background_threshold: int = 10,
    alpha_matting_erode_size: int = 10,
    post_process_mask: bool = False,
) -> Tuple[np.ndarray, np.ndarray]:
    # Flip channels to RGB mode and convert to PIL Image
    img = (img * 255).astype(np.uint8)
    _, _, c = get_h_w_c(img)
    if c == 3:
        img = cvtColor(img, COLOR_BGR2RGB)
    elif c == 4:
        img = cvtColor(img, COLOR_BGRA2RGB)
    pimg = Image.fromarray(img)

    session = new_session(ort_session)

    masks = session.predict(pimg)
    cutouts = []

    assert len(masks) > 0, "Model failed to generate masks"

    for mask in masks:
        if post_process_mask:
            mask = Image.fromarray(post_process(np.array(mask)))

        if alpha_matting:
            try:
                cutout = alpha_matting_cutout(
                    pimg,
                    mask,
                    alpha_matting_foreground_threshold,
                    alpha_matting_background_threshold,
                    alpha_matting_erode_size,
                )
            except ValueError:
                cutout = naive_cutout(pimg, mask)
        else:
            cutout = naive_cutout(pimg, mask)

        cutouts.append(cutout)

    cutout = pimg
    if len(cutouts) > 0:
        cutout = get_concat_v_multi(cutouts)

    return cvtColor(normalize(np.asarray(cutout)), COLOR_RGBA2BGRA), normalize(np.asarray(mask))  # type: ignore  pylint: disable=undefined-loop-variable
