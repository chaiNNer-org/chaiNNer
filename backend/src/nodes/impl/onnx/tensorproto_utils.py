from sys import float_info

import numpy as np
from onnx import numpy_helper as onph
from onnx.onnx_pb import AttributeProto, NodeProto, TensorProto
from sanic.log import logger

INT64_MIN, INT64_MAX = np.iinfo(np.int64).min, np.iinfo(np.int64).max
FLOAT32_MAX = float_info.max

APT = AttributeProto
TPT = TensorProto


def get_node_attr_ai(node: NodeProto, key: str) -> np.ndarray:
    for attr in node.attribute:
        if attr.name == key:
            return np.array(
                [max(min(i, INT64_MAX), INT64_MIN) for i in attr.ints], np.int64
            )

    return np.empty(0, np.int32)


def set_node_attr_ai(node: NodeProto, key: str, value: np.ndarray) -> None:
    attr_group = AttributeProto(name=key, floats=value, type=APT.INTS)
    node.attribute.append(attr_group)


def get_node_attr_af(node: NodeProto, key: str) -> np.ndarray:
    for attr in node.attribute:
        if attr.name == key:
            return np.array([f for f in attr.floats], np.float32)

    return np.empty(0, np.float32)


def get_node_attr_i(node: NodeProto, key: str, default: int = 0) -> int:
    for attr in node.attribute:
        if attr.name == key:
            return max(min(attr.i, INT64_MAX), INT64_MIN)

    return default


def get_node_attr_f(node: NodeProto, key: str, default: float = 0) -> float:
    for attr in node.attribute:
        if attr.name == key:
            return attr.f

    return default


def get_node_attr_s(node: NodeProto, key: str, default: str = ""):
    for attr in node.attribute:
        if attr.name == key:
            return attr.s.decode("ascii")

    return default


def get_node_attr_tensor(node: NodeProto, key: str) -> TensorProto:
    for attr in node.attribute:
        if attr.name == key:
            return attr.t

    return TensorProto()


def get_node_attr_from_input_f(tp: TensorProto) -> float:
    shape_data = onph.to_array(tp)

    if tp.data_type in (TPT.FLOAT, TPT.FLOAT16, TPT.DOUBLE, TPT.INT32):
        f = shape_data.item(0)
    elif tp.data_type == TPT.INT64:
        f = max(min(shape_data.item(0), INT64_MAX), INT64_MIN)
    else:
        raise TypeError(f"Unknown data type {tp.data_type}")

    return f


def get_node_attr_from_input_ai(tp: TensorProto) -> np.ndarray:
    if tp.data_type in (TPT.INT32, TPT.INT64):
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


def get_node_attr_from_input_af(tp: TensorProto) -> np.ndarray:
    if tp.data_type in (TPT.FLOAT, TPT.FLOAT16, TPT.DOUBLE):
        shape_data = onph.to_array(tp)
        return np.array([val for val in shape_data], shape_data.dtype)
    else:
        logger.error(f"Unknown data type {tp.data_type}")

    return np.empty(0, np.float32)


def get_tensor_proto_data_size(tp: TensorProto, fpmode: int = TPT.FLOAT) -> int:
    if tp.raw_data:
        if fpmode == TPT.FLOAT16:
            return len(tp.raw_data) // 2
        return len(tp.raw_data) // 4
    elif tp.data_type in (TPT.FLOAT, TPT.FLOAT16):
        return len(tp.float_data)

    return 0
