from __future__ import annotations

import gc

import numpy as np
import onnxruntime as ort

from ..upscale.auto_split import Tiler, auto_split
from .np_tensor_utils import np2nptensor, nptensor2np


def onnx_auto_split(
    img: np.ndarray,
    session: ort.InferenceSession,
    change_shape: bool,
    tiler: Tiler,
) -> np.ndarray:
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    is_fp16_model = session.get_inputs()[0].type == "tensor(float16)"

    def upscale(img: np.ndarray, _):
        try:
            lr_img = np2nptensor(img, change_range=False)
            lr_img = lr_img.astype(np.float16) if is_fp16_model else lr_img

            if change_shape:
                # Transpose from BCHW to BHWC
                lr_img = np.transpose(lr_img, (0, 2, 3, 1))

            output: np.ndarray = session.run([output_name], {input_name: lr_img})[0]

            if change_shape:
                # Transpose back to BCHW
                output = np.transpose(output, (0, 3, 1, 2))

            return nptensor2np(output, change_range=False, imtype=np.float32)
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
