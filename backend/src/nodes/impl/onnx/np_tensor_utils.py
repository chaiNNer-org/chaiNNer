from __future__ import annotations

import numpy as np

from ..image_utils import MAX_VALUES_BY_DTYPE, as_3d


def np_denorm(x: np.ndarray, min_max: tuple[float, float] = (-1.0, 1.0)) -> np.ndarray:
    """Denormalize from [-1,1] range to [0,1]
    formula: xi' = (xi - mu)/sigma
    Example: "out = (x + 1.0) / 2.0" for denorm
        range (-1,1) to (0,1)
    for use with proper act in Generator output (ie. tanh)
    """
    out = (x - min_max[0]) / (min_max[1] - min_max[0])
    return np.clip(out, 0, 1)


def np_norm(x: np.ndarray) -> np.ndarray:
    """Normalize (z-norm) from [0,1] range to [-1,1]"""
    out = (x - 0.5) * 2.0
    return np.clip(out, -1, 1)


def np_bgr_to_rgb(img: np.ndarray) -> np.ndarray:
    out: np.ndarray = img[::-1, ...]
    return out


def np_rgb_to_bgr(img: np.ndarray) -> np.ndarray:
    # same operation as bgr_to_rgb(), flip image channels
    return np_bgr_to_rgb(img)


def np_bgra_to_rgba(img: np.ndarray) -> np.ndarray:
    out: np.ndarray = img[[2, 1, 0, 3], ...]  # type: ignore
    return out


def np_rgba_to_bgra(img: np.ndarray) -> np.ndarray:
    # same operation as bgra_to_rgba(), flip image channels
    return np_bgra_to_rgba(img)


def np2nptensor(
    img: np.ndarray,
    bgr2rgb: bool = True,
    data_range: float = 1.0,
    normalize: bool = False,
    change_range: bool = True,
    add_batch: bool = True,
) -> np.ndarray:
    """Converts a numpy image array into a numpy Tensor array.
    Parameters:
        img (numpy array): the input image numpy array
        add_batch (bool): choose if new tensor needs batch dimension added
    """
    # check how many channels the image has, then condition. ie. RGB, RGBA, Gray
    # if bgr2rgb:
    #     img = img[
    #         :, :, [2, 1, 0]
    #     ]  # BGR to RGB -> in numpy, if using OpenCV, else not needed. Only if image has colors.
    if change_range:
        dtype = img.dtype
        maxval = MAX_VALUES_BY_DTYPE.get(dtype.name, 1.0)
        t_dtype = np.dtype("float32")
        img = img.astype(t_dtype) / maxval  # ie: uint8 = /255
    # "HWC to CHW" and "numpy to tensor"
    img = np.ascontiguousarray(np.transpose(as_3d(img), (2, 0, 1))).astype(np.float32)
    if bgr2rgb:
        # BGR to RGB -> in tensor, if using OpenCV, else not needed. Only if image has colors.)
        if (
            img.shape[0] % 3 == 0
        ):  # RGB or MultixRGB (3xRGB, 5xRGB, etc. For video tensors.)
            img = np_bgr_to_rgb(img)
        elif img.shape[0] == 4:  # RGBA
            img = np_bgra_to_rgba(img)
    if add_batch:
        img = np.expand_dims(
            img, axis=0
        )  # Add fake batch dimension = 1 . squeeze() will remove the dimensions of size 1
    if normalize:
        img = np_norm(img)
    return img


def nptensor2np(
    img: np.ndarray,
    rgb2bgr: bool = True,
    remove_batch: bool = True,
    data_range: float = 255,
    denormalize: bool = False,
    change_range: bool = True,
    imtype: type = np.uint8,
) -> np.ndarray:
    """Converts a Tensor array into a numpy image array.
    Parameters:
        img (tensor): the input image tensor array
            4D(B,(3/1),H,W), 3D(C,H,W), or 2D(H,W), any range, RGB channel order
        remove_batch (bool): choose if tensor of shape BCHW needs to be squeezed
        denormalize (bool): Used to denormalize from [-1,1] range back to [0,1]
        imtype (type): the desired type of the converted numpy array (np.uint8
            default)
    Output:
        img (np array): 3D(H,W,C) or 2D(H,W), [0,255], np.uint8 (default)
    """
    n_dim = img.ndim

    img = img.astype(np.float32)

    if n_dim in (4, 3):
        # if n_dim == 4, has to convert to 3 dimensions
        if n_dim == 4 and remove_batch:
            # remove a fake batch dimension
            img = img.squeeze(0)

        if img.shape[0] == 3 and rgb2bgr:  # RGB
            # RGB to BGR -> in tensor, if using OpenCV, else not needed. Only if image has colors.
            img_np = np_rgb_to_bgr(img)
        elif img.shape[0] == 4 and rgb2bgr:  # RGBA
            # RGBA to BGRA -> in tensor, if using OpenCV, else not needed. Only if image has colors.
            img_np = np_rgba_to_bgra(img)
        else:
            img_np = img
        img_np = np.transpose(img_np, (1, 2, 0))  # CHW to HWC
    elif n_dim == 2:
        img_np = img
    else:
        raise TypeError(
            f"Only support 4D, 3D and 2D tensor. But received with dimension: {n_dim:d}"
        )

    # if rgb2bgr:
    # img_np = img_np[[2, 1, 0], :, :] #RGB to BGR -> in numpy, if using OpenCV, else not needed. Only if image has colors.
    # TODO: Check: could denormalize in the begining in tensor form instead
    if denormalize:
        img_np = np_denorm(img_np)  # denormalize if needed
    if change_range:
        img_np = np.clip(
            data_range * img_np,
            0,
            data_range,
        ).round()  # np.clip to the data_range

    # has to be in range (0,255) before changing to np.uint8, else np.float32
    return img_np.astype(imtype)
