# This class defines an interface.
# It is important that is does not contain types that depend on ONNX.
from typing import Union

import re2

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


class OnnxGeneric:
    def __init__(self, model_as_bytes: bytes):
        self.bytes: bytes = model_as_bytes
        self.sub_type = "Generic"
        self.scale_height = None
        self.scale_width = None


class OnnxRemBg:
    def __init__(self, model_as_bytes: bytes, scale_height: int = 1):
        self.bytes: bytes = model_as_bytes
        self.sub_type = "RemBg"
        self.scale_height = scale_height
        self.scale_width = 1


OnnxModels = (OnnxGeneric, OnnxRemBg)
OnnxModel = Union[OnnxGeneric, OnnxRemBg]


def is_rembg_model(model_as_bytes: bytes) -> bool:
    if (
        U2NET_STANDARD.search(model_as_bytes[-600:]) is not None
        or U2NET_CLOTH.search(model_as_bytes[-1000:]) is not None
        or U2NET_SILUETA.search(model_as_bytes[-600:]) is not None
        or U2NET_ISNET.search(model_as_bytes[:10000]) is not None
    ):
        return True
    return False


def load_onnx_model(model_as_bytes: bytes) -> OnnxModel:
    if (
        U2NET_STANDARD.search(model_as_bytes[-1000:]) is not None
        or U2NET_SILUETA.search(model_as_bytes[-600:]) is not None
        or U2NET_ISNET.search(model_as_bytes[:10000]) is not None
    ):
        model = OnnxRemBg(model_as_bytes)
    elif U2NET_CLOTH.search(model_as_bytes[-1000:]) is not None:
        model = OnnxRemBg(model_as_bytes, scale_height=3)
    else:
        model = OnnxGeneric(model_as_bytes)

    return model
