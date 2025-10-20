from __future__ import annotations

import cv2
import numpy as np
import onnxruntime as ort
from pymatting import estimate_alpha_cf, estimate_foreground_ml
from scipy.ndimage import binary_erosion

from ...utils.utils import get_h_w_c
from .session_factory import new_session


def assert_rgb(img: np.ndarray):
    assert get_h_w_c(img)[2] == 3


def assert_gray(img: np.ndarray):
    assert img.ndim == 2


def alpha_matting_cutout(
    img: np.ndarray,
    mask: np.ndarray,
    foreground_threshold: int,
    background_threshold: int,
    erode_structure_size: int,
) -> np.ndarray:
    assert_rgb(img)
    assert_gray(mask)

    is_foreground = mask > (foreground_threshold / 255)
    is_background = mask < (background_threshold / 255)

    structure = None
    if erode_structure_size > 0:
        structure = np.ones(
            (erode_structure_size, erode_structure_size), dtype=np.uint8
        )

    is_foreground = binary_erosion(is_foreground, structure=structure)
    is_background = binary_erosion(is_background, structure=structure, border_value=1)

    trimap = np.full(mask.shape, dtype=np.float64, fill_value=0.5)
    trimap[is_foreground] = 1
    trimap[is_background] = 0

    img64 = img.astype(np.float64)
    alpha = estimate_alpha_cf(img64, trimap)
    foreground = estimate_foreground_ml(img64, alpha)
    assert isinstance(foreground, np.ndarray)

    return np.dstack((foreground.astype(np.float32), alpha.astype(np.float32)))


def naive_cutout(img: np.ndarray, mask: np.ndarray) -> np.ndarray:
    assert_rgb(img)
    assert_gray(mask)
    return np.dstack((img, mask))


def post_process(mask: np.ndarray) -> np.ndarray:
    """
    Post Process the mask for a smooth boundary by applying Morphological Operations
    Research based on paper: https://www.sciencedirect.com/science/article/pii/S2352914821000757
    args:
        mask: Binary Numpy Mask
    """
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.GaussianBlur(
        mask, (5, 5), sigmaX=2, sigmaY=2, borderType=cv2.BORDER_DEFAULT
    )
    mask = np.where(mask < 0.5, 0, 1).astype(np.float32)
    return mask


def remove_bg(
    img: np.ndarray,
    ort_session: ort.InferenceSession,
    alpha_matting: bool = False,
    alpha_matting_foreground_threshold: int = 240,
    alpha_matting_background_threshold: int = 10,
    alpha_matting_erode_size: int = 10,
    post_process_mask: bool = False,
) -> tuple[np.ndarray, np.ndarray]:
    # Flip channels to RGB mode
    assert_rgb(img)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    session = new_session(ort_session)

    masks: list[np.ndarray] = session.predict(img)
    cutouts: list[np.ndarray] = []

    assert len(masks) > 0, "Model failed to generate masks"

    mask = None
    for mask in masks:
        if post_process_mask:
            mask = post_process(mask)  # noqa

        if alpha_matting:
            try:
                cutout = alpha_matting_cutout(
                    img,
                    mask,
                    alpha_matting_foreground_threshold,
                    alpha_matting_background_threshold,
                    alpha_matting_erode_size,
                )
            except ValueError:
                cutout = naive_cutout(img, mask)
        else:
            cutout = naive_cutout(img, mask)

        cutouts.append(cutout)

    if mask is None or len(cutouts) == 0:
        raise ValueError("Model failed to generate masks")

    cutout = cv2.vconcat(cutouts)

    return cv2.cvtColor(cutout, cv2.COLOR_RGBA2BGRA), mask
