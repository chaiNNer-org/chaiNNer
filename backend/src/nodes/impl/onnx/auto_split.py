from __future__ import annotations

import gc

import numpy as np
import onnxruntime as ort

from ..upscale.auto_split import Tiler, auto_split


def _into_batched_form(img: np.ndarray) -> np.ndarray:
    shape_size = len(img.shape)
    if shape_size == 3:
        # (H, W, C) -> (1, C, H, W)
        return img.transpose((2, 0, 1))[np.newaxis, :]
    elif shape_size == 2:
        # (H, W) -> (1, 1, H, W)
        return img[np.newaxis, np.newaxis, :]
    else:
        raise ValueError("Unsupported input tensor shape")


def _into_standard_image_form(img: np.ndarray) -> np.ndarray:
    shape_size = len(img.shape)
    if shape_size == 4:
        # (1, C, H, W) -> (H, W, C)
        return img.squeeze(0).transpose(1, 2, 0)
    elif shape_size == 3:
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


def onnx_auto_split(
    img: np.ndarray,
    session: ort.InferenceSession,
    tiler: Tiler,
) -> np.ndarray:
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    is_fp16_model = session.get_inputs()[0].type == "tensor(float16)"

    def upscale(img: np.ndarray, _: object):
        try:
            lr_img = img.astype(np.float16) if is_fp16_model else img
            lr_img = _flip_r_b_channels(lr_img)
            lr_img = _into_batched_form(lr_img)

            output: np.ndarray = session.run([output_name], {input_name: lr_img})[0]

            output = _into_standard_image_form(output)
            output = _flip_r_b_channels(output)
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
