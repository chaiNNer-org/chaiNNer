from sys import float_info

import numpy as np
import onnx
from onnx import numpy_helper as onph
from sanic.log import logger

INT64_MIN, INT64_MAX = np.iinfo(np.int64).min, np.iinfo(np.int64).max
FLOAT32_MAX = float_info.max


class AttributeProtoTypes:
    FLOAT = 1
    INT = 2
    STRING = 3
    TENSOR = 4
    GRAPH = 5
    FLOATS = 6
    INTS = 7
    STRINGS = 8
    TENSORS = 9
    GRAPHS = 10


class TensorProtoTypes:
    UNDEFINED = 0
    FLOAT = 1
    UINT8 = 2
    INT8 = 3
    UINT16 = 4
    INT16 = 5
    INT32 = 6
    INT64 = 7
    STRING = 8
    BOOL = 9
    FLOAT16 = 10
    DOUBLE = 11
    UINT32 = 12
    UINT64 = 13
    COMPLEX64_VALUE = 14
    COMPLEX128_VALUE = 15


APT = AttributeProtoTypes
TPT = TensorProtoTypes


def get_node_attr_ai(node: onnx.NodeProto, key: str) -> np.ndarray:
    for attr in node.attribute:
        if attr.name == key:
            return np.array(
                [max(min(i, INT64_MAX), INT64_MIN) for i in attr.ints], np.int64
            )

    return np.empty(0, np.int32)


def set_node_attr_ai(node: onnx.NodeProto, key: str, value: np.ndarray) -> None:
    attr_group = onnx.AttributeProto(name=key, floats=value, type=APT.INTS)
    node.attribute.append(attr_group)


def get_node_attr_af(node: onnx.NodeProto, key: str) -> np.ndarray:
    for attr in node.attribute:
        if attr.name == key:
            return np.array([f for f in attr.floats], np.float32)

    return np.empty(0, np.float32)


def get_node_attr_i(node: onnx.NodeProto, key: str, default: int = 0) -> int:
    for attr in node.attribute:
        if attr.name == key:
            return max(min(attr.i, INT64_MAX), INT64_MIN)

    return default


def get_node_attr_f(node: onnx.NodeProto, key: str, default: float = 0) -> float:
    for attr in node.attribute:
        if attr.name == key:
            return attr.f

    return default


def get_node_attr_s(node: onnx.NodeProto, key: str, default: str = ""):
    for attr in node.attribute:
        if attr.name == key:
            return attr.s.decode("ascii")

    return default


def get_node_attr_tensor(node: onnx.NodeProto, key: str) -> onnx.TensorProto:
    for attr in node.attribute:
        if attr.name == key:
            return attr.t

    return onnx.TensorProto()


def get_node_attr_from_input_f(tp: onnx.TensorProto) -> float:
    shape_data = onph.to_array(tp)

    if tp.data_type in (TPT.FLOAT, TPT.DOUBLE, TPT.INT32):
        f = shape_data.item(0)
    elif tp.data_type == TPT.INT64:
        f = max(min(shape_data.item(0), INT64_MAX), INT64_MIN)
    else:
        raise TypeError(f"Unknown data type {tp.data_type}")

    return f


def get_node_attr_from_input_ai(tp: onnx.TensorProto) -> np.ndarray:
    if tp.data_type == TPT.INT32 or tp.data_type == TPT.INT64:
        shape_data = onph.to_array(tp)
        if shape_data.size == 1:
            shape_data = np.array([shape_data.item(0)], shape_data.dtype)
        return np.array(
            [
                max(min(val, INT64_MAX), INT64_MIN)
                if tp.data_type == TPT.INT64
                else val
                for val in shape_data
            ],
            shape_data.dtype,
        )
    else:
        logger.error(f"Unknown data type {tp.data_type}")

    return np.empty(0, np.int32)


def get_node_attr_from_input_af(tp: onnx.TensorProto) -> np.ndarray:
    if tp.data_type == TPT.FLOAT or tp.data_type == TPT.DOUBLE:
        shape_data = onph.to_array(tp)
        return np.array([val for val in shape_data], shape_data.dtype)
    else:
        logger.error(f"Unknown data type {tp.data_type}")

    return np.empty(0, np.float32)


def get_tensor_proto_data_size(tp: onnx.TensorProto) -> int:
    if tp.raw_data:
        return len(tp.raw_data) // 4
    elif tp.data_type == TPT.FLOAT:
        return len(tp.float_data)

    return 0
