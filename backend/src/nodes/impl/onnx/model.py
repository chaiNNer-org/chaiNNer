# This class defines an interface.
# It is important that is does not contain types that depend on ONNX.
from typing import Union

import re2
from sanic.log import logger


re2_options = re2.Options()
re2_options.dot_nl = True
re2_options.encoding = re2.Options.Encoding.LATIN1

U2NET_STANDARD = re2.compile(b"1959.+1960.+1961.+1962.+1963.+1964.+1965", re2_options)
U2NET_CLOTH = re2.compile(
    b"output.+d1.+Concat_1876.+Concat_1896.+Concat_1916.+Concat_1936.+Concat_1956",
    re2_options,
)


class OnnxGenericModel:
    def __init__(self, model_as_bytes: bytes):
        self.bytes: bytes = model_as_bytes
        self.arch = "generic"
        self.sub_type = "Generic"


class OnnxRemBgModel:
    def __init__(self, model_as_bytes: bytes):
        self.bytes: bytes = model_as_bytes
        self.arch = "u2net"
        self.sub_type = "RemBg"


OnnxModels = (OnnxGenericModel, OnnxRemBgModel)
OnnxModel = Union[OnnxGenericModel, OnnxRemBgModel]


def isRemBgModel(model_as_bytes: bytes) -> bool:
    if (
        U2NET_STANDARD.search(model_as_bytes[-600:]) is not None
        or U2NET_CLOTH.search(model_as_bytes[-1000:]) is not None
    ):
        return True
    return False


def load_onnx_model(model_as_bytes: bytes) -> OnnxModel:
    if isRemBgModel(model_as_bytes):
        model = OnnxRemBgModel(model_as_bytes)
    else:
        model = OnnxGenericModel(model_as_bytes)

    return model
