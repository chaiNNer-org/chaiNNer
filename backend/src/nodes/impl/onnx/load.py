from __future__ import annotations

import onnx
import onnx.inliner
import re2
from sanic.log import logger

from .model import OnnxGeneric, OnnxInfo, OnnxModel, OnnxRemBg, SizeReq
from .utils import (
    ModelShapeInference,
    get_opset,
    get_tensor_fp_datatype,
)

re2_options = re2.Options()
re2_options.dot_nl = True
re2_options.encoding = re2.Options.Encoding.LATIN1

U2NET_STANDARD = re2.compile(b"1959.+1960.+1961.+1962.+1963.+1964.+1965", re2_options)
U2NET_CLOTH = re2.compile(
    b"output.+d1.+Concat_1876.+Concat_1896.+Concat_1916.+Concat_1936.+Concat_1956",
    re2_options,
)
U2NET_SILUETA = re2.compile(b"1808.+1827.+1828.+2296.+1831.+1850.+1958", re2_options)
U2NET_ISNET = re2.compile(
    b"/stage1/rebnconvin/conv_s1/Conv.+/stage1/rebnconvin/relu_s1/Relu", re2_options
)


def _detect_size_req(infer: ModelShapeInference):
    if infer.fixed_input_width is not None and infer.fixed_input_height is not None:
        shape = infer.infer_shape((infer.fixed_input_width, infer.fixed_input_height))
        return SizeReq(), shape

    for size in [16, 64, 256, 512]:
        try:
            shape = infer.infer_shape((size, size))
            out_h, out_w, _ = shape[1]
            if out_h is not None and out_w is not None:
                return SizeReq(multiple_of=size), shape
        except Exception:
            logger.error(f"Failed to infer shape for size {size}", exc_info=True)

    return SizeReq(), None


def load_onnx_model(model_or_bytes: onnx.ModelProto | bytes) -> OnnxModel:
    if isinstance(model_or_bytes, onnx.ModelProto):
        model = model_or_bytes
        model_as_bytes = model.SerializeToString()
    else:
        model_as_bytes = model_or_bytes
        model = onnx.load_model_from_string(model_or_bytes)

    info = OnnxInfo(
        opset=get_opset(model),
        dtype=get_tensor_fp_datatype(model),
    )

    if (
        U2NET_STANDARD.search(model_as_bytes[-1000:]) is not None
        or U2NET_SILUETA.search(model_as_bytes[-600:]) is not None
        or U2NET_ISNET.search(model_as_bytes[:10000]) is not None
    ):
        info.scale_width = 1
        info.scale_height = 1
        return OnnxRemBg(model_as_bytes, info)
    elif U2NET_CLOTH.search(model_as_bytes[-1000:]) is not None:
        info.scale_width = 1
        info.scale_height = 3
        return OnnxRemBg(model_as_bytes, info)
    else:
        try:
            infer = ModelShapeInference(model)
            info.fixed_input_width = infer.fixed_input_width
            info.fixed_input_height = infer.fixed_input_height
            info.input_channels = infer.input_channels
            info.output_channels = infer.output_channels

            size_req, shape_result = _detect_size_req(infer)
            info.size_req = size_req

            if shape_result:
                i_hwc, o_hwc = shape_result
                i_h, i_w, _i_c = i_hwc
                o_h, o_w, o_c = o_hwc

                def get_scale(i: int | None, o: int | None) -> int | None:
                    if i is None or o is None:
                        return None
                    if o % i != 0:
                        return None
                    return o // i

                info.scale_width = get_scale(i_w, o_w)
                info.scale_height = get_scale(i_h, o_h)
                info.output_channels = o_c
        except Exception:
            pass

        return OnnxGeneric(model_as_bytes, info)
