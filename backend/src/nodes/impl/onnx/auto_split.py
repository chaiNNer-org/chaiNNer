from __future__ import annotations

import gc
from typing import Callable

import numpy as np
import onnxruntime as ort

from nodes.impl.onnx.model import SizeReq

from ..upscale.auto_split import Tiler, auto_split


def _into_batched_form(img: np.ndarray, change_shape: bool) -> np.ndarray:
    shape_size = len(img.shape)
    if shape_size == 3:
        if change_shape:
            # (H, W, C) -> (1, H, W, C)
            return img[np.newaxis, :]
        else:
            # (H, W, C) -> (1, C, H, W)
            return img.transpose((2, 0, 1))[np.newaxis, :]
    elif shape_size == 2:
        if change_shape:
            # (H, W) -> (1, H, W, 1)
            return img[np.newaxis, :, np.newaxis]
        else:
            # (H, W) -> (1, 1, H, W)
            return img[np.newaxis, np.newaxis, :]
    else:
        raise ValueError("Unsupported input tensor shape")


def _into_standard_image_form(img: np.ndarray, change_shape: bool) -> np.ndarray:
    shape_size = len(img.shape)
    if shape_size == 4:
        if change_shape:
            # (1, H, W, C) -> (H, W, C)
            return img.squeeze(0)
        else:
            # (1, C, H, W) -> (H, W, C)
            return img.squeeze(0).transpose(1, 2, 0)
    elif shape_size == 3:
        if change_shape:
            # (H, W, C) -> (H, W, C)
            return img
        else:
            # (C, H, W) -> (H, W, C)
            return img.transpose(1, 2, 0)
    elif shape_size == 2:
        # (H, W)
        return img
    else:
        raise ValueError("Unsupported output tensor shape")


def _flip_r_b_channels(img: np.ndarray) -> np.ndarray:
    shape_size = len(img.shape)
    if shape_size != 3:
        return img
    if img.shape[2] == 3:
        # (H, W, C) RGB -> BGR
        return np.flip(img, 2)
    elif img.shape[2] == 4:
        # (H, W, C) RGBA -> BGRA
        return np.dstack((img[:, :, 2], img[:, :, 1], img[:, :, 0], img[:, :, 3]))
    return img


def _pad(
    img: np.ndarray, req: SizeReq
) -> tuple[np.ndarray, Callable[[np.ndarray], np.ndarray]]:
    w = img.shape[1]
    h = img.shape[0]

    pad_w, pad_h = req.get_padding(w, h)

    def remove_padding(i: np.ndarray) -> np.ndarray:
        new_w = i.shape[1]
        new_h = i.shape[0]
        scale_w = new_w // (w + pad_w)
        scale_h = new_h // (h + pad_h)
        new_pad_w = int(pad_w * scale_w)
        new_pad_h = int(pad_h * scale_h)
        return i[: new_h - new_pad_h, : new_w - new_pad_w]

    if pad_w or pad_h:
        paddings = [(0, pad_h), (0, pad_w)]
        if len(img.shape) == 3:
            paddings.append((0, 0))
        img = np.pad(img, paddings, "reflect")

        return img, remove_padding
    else:
        return img, lambda i: i


def onnx_auto_split(
    img: np.ndarray,
    session: ort.InferenceSession,
    change_shape: bool,
    tiler: Tiler,
    size_req: SizeReq | None = None,
) -> np.ndarray:
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    is_fp16_model = session.get_inputs()[0].type == "tensor(float16)"

    def upscale(img: np.ndarray, _: object):
        try:
            lr_img = img.astype(np.float16) if is_fp16_model else img
            lr_img, remove_pad = _pad(lr_img, size_req or SizeReq())
            lr_img = _flip_r_b_channels(lr_img)
            lr_img = _into_batched_form(lr_img, change_shape)

            output = np.asarray(session.run([output_name], {input_name: lr_img})[0])

            output = _into_standard_image_form(output, change_shape)
            output = _flip_r_b_channels(output)
            output = remove_pad(output)
            return output.astype(np.float32)
        except Exception as e:
            if "ONNXRuntimeError" in str(e) and (
                "allocate memory" in str(e)
                or "out of memory" in str(e)
                or "cudaMalloc" in str(e)
            ):
                raise RuntimeError(  # noqa: B904
                    "A VRAM out-of-memory error has occurred. Please try using a more extreme tiling mode."
                )
            else:
                # Re-raise the exception if not an OOM error
                raise

    try:
        return auto_split(img, upscale, tiler)
    finally:
        gc.collect()
