from typing import Union, List, Dict

import numpy as np
import onnx
import onnx.numpy_helper as onph
from google.protobuf.internal.containers import (
    RepeatedCompositeFieldContainer,
    RepeatedScalarFieldContainer,
)
from sanic.log import logger

from .ncnn_structure import NcnnObject

INT64_MIN, INT64_MAX = np.iinfo(np.int64).min, np.iinfo(np.int64).max
FLOAT32_MAX = np.finfo(np.float32).max
"""TENSOR_TO_NP_DTYPE = {
    0: None,
    1: np.float32,
    2: np.uint8,
    3: np.int8,
    4: np.uint16,
    5: np.int16,
    6: np.int32,
    7: np.int64,
    8: np.str_,
    9: np.bool_,
    10: np.float16,
    11: np.double,
    12: np.uint32,
    13: np.uint64,
    14: np.complex64,
    15: np.complex128,
}"""


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


class Onnx2NcnnConverter:
    def __init__(self, onnx_model: onnx.ModelProto):
        self.onnx_graph: onnx.GraphProto = onnx_model.graph
        self.mutable_graph_nodes: List[onnx.NodeProto] = [
            n for n in self.onnx_graph.node
        ]
        self.node_count: int = len(self.onnx_graph.node)
        self.weights: Dict[str, onnx.TensorProto] = {
            initializer.name: initializer for initializer in self.onnx_graph.initializer
        }
        self.producers: Dict[str, None] = {i.name: None for i in self.onnx_graph.input}
        self.node_reference: Dict[str, int] = {}
        self.blob_names: Dict[str, None] = {}

    '''def __repr__(self) -> str:
        return f"""Graph (Node count: {self.node_count}):\n
            \t{self.mutable_graph}\n\n
            Producers:\n
            \t{self.producers}\n\n
            Node Reference:\n
            \t{self.node_reference}\n\n
            Blob Names:\n
            \t{self.blob_names}\n"""'''

    def swap_nodes(self, a: int, b: int) -> None:
        self.mutable_graph_nodes[a], self.mutable_graph_nodes[b] = (
            self.mutable_graph_nodes[b],
            self.mutable_graph_nodes[a],
        )

    @staticmethod
    def clear_container(
        container: Union[RepeatedCompositeFieldContainer, RepeatedScalarFieldContainer],
    ) -> None:
        for _ in range(len(container)):
            container.pop()

    @staticmethod
    def get_node_attr_ai(node: onnx.NodeProto, key: str) -> np.ndarray:
        for attr in node.attribute:
            if attr.name == key:
                v = np.empty((len(attr.ints),), np.int64)
                for i in range(len(attr.ints)):
                    v[i] = max(min(attr.ints[i], INT64_MAX), INT64_MAX)
                return v

        return np.empty(0, np.int32)

    @staticmethod
    def set_node_attr_ai(node: onnx.NodeProto, key: str, value: np.ndarray) -> None:
        attr_group = onnx.AttributeProto(name=key, type=APT.INTS)
        for v in value:
            attr_group.ints.append(v)

        node.attribute.append(attr_group)

    @staticmethod
    def get_node_attr_af(node: onnx.NodeProto, key: str) -> np.ndarray:
        for attr in node.attribute:
            if attr.name == key:
                return np.array([f for f in attr.floats], np.float32)

        return np.empty(0, np.float32)

    @staticmethod
    def get_node_attr_i(node: onnx.NodeProto, key: str, default: int = 0) -> int:
        for attr in node.attribute:
            if attr.name == key:
                return max(min(attr.i, INT64_MAX), INT64_MIN)

        return default

    @staticmethod
    def get_node_attr_f(node: onnx.NodeProto, key: str, default: float = 0) -> float:
        for attr in node.attribute:
            if attr.name == key:
                return attr.f

        return default

    @staticmethod
    def get_node_attr_s(node: onnx.NodeProto, key: str, default: str = ""):
        for attr in node.attribute:
            if attr.name == key:
                return attr.s

        return default

    @staticmethod
    def get_node_attr_tensor(node: onnx.NodeProto, key: str) -> onnx.TensorProto:
        for attr in node.attribute:
            if attr.name == key:
                return attr.t

        return onnx.TensorProto()

    @staticmethod
    def get_node_attr_from_input_f(tp: onnx.TensorProto) -> float:
        shape_data = onph.to_array(tp)
        if tp.data_type in (TPT.FLOAT, TPT.DOUBLE, TPT.INT32):
            f = shape_data[0]
        elif tp.data_type == TPT.INT64:
            f = max(min(shape_data[0], INT64_MAX), INT64_MIN)
        else:
            raise TypeError(f"Unknown data type {tp.data_type}")

        return f

    @staticmethod
    def get_node_attr_from_input_ai(tp: onnx.TensorProto) -> np.ndarray:
        if tp.data_type == TPT.INT32 or tp.data_type == TPT.INT64:
            shape_data = onph.to_array(tp)
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

    @staticmethod
    def get_node_attr_from_input_af(tp: onnx.TensorProto) -> np.ndarray:
        if tp.data_type == TPT.FLOAT or tp.data_type == TPT.DOUBLE:
            shape_data = onph.to_array(tp)
            return np.array([val for val in shape_data], shape_data.dtype)
        else:
            logger.error(f"Unknown data type {tp.data_type}")

        return np.empty(0, np.float32)

    @staticmethod
    def get_tensor_proto_data_size(tp: onnx.TensorProto) -> int:
        if tp.raw_data:
            return len(tp.raw_data) // 4
        elif tp.data_type == TPT.FLOAT:
            return len(tp.float_data)

        return 0

    def fwrite_tensor_proto_data(self, tp: onnx.TensorProto, ncnno: NcnnObject):
        # TODO: Figure out ncnn structure to decide how to write to it
        size = self.get_tensor_proto_data_size(tp)

        if tp.raw_data:
            raw_data = tp.raw_data
        elif tp.data_type == TPT.FLOAT:
            pass

    def fuse_rewrite_gather(self) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            gather = self.mutable_graph_nodes[i]
            indices = self.get_node_attr_from_input_ai(self.weights[gather.input[1]])
            if gather.op_type == "Gather" and len(indices) == 1:
                # Reconstruct node connections
                self.node_reference[gather.input[1]] -= 1
                origin_inp = gather.input[0]
                gather.ClearField("input")
                gather.input.append(origin_inp)

                # Update axis, starts and ends
                axis = self.get_node_attr_i(gather, "axis", 1)
                gather.op_type = "Crop"
                gather.ClearField("attribute")

                index = indices[0]
                self.set_node_attr_ai(gather, "starts", np.array([index], np.int32))
                self.set_node_attr_ai(gather, "ends", np.array([index + 1], np.int32))
                self.set_node_attr_ai(gather, "axis", np.array([axis], np.int32))

    def fuse_weight_reshape(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]
            if node.op_type == "Reshape":
                if node.input[0] in self.weights:
                    self.weights[node.output[0]] = self.weights[node.input[0]]
                    if len(node.input) == 1:
                        shape = self.get_node_attr_ai(node, "shape")
                    elif len(node.input) == 2:
                        shape = self.get_node_attr_from_input_ai(
                            self.weights[node.input[1]]
                        )
                    else:
                        shape = np.empty(0, np.int64)

                    self.clear_container(self.weights[node.output[0]].dims)
                    for dim in shape:
                        self.weights[node.output[0]].dims.append(dim)

                    node.op_type = "noop_reducedncnn"

                    self.node_reference[node.input[0]] -= 1
                    if len(node.input) == 2:
                        self.node_reference[node.input[1]] -= 1

                    reduced_node_count[0] += 1
                    i += 1

    def fuse_weight_transpose(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]
            if node.op_type == "Transpose":
                if node.input[0] in self.weights and len(node.input[0].dims) == 2:
                    perm = self.get_node_attr_ai(node, "perm")
                    if perm.size == 2 and perm[0] == 1 and perm[1] == 0:
                        self.weights[node.output[0]] = self.weights[node.input[0]]

                        # Permute weight
                        B = self.weights[node.output[0]]

                        h, w = B.dims[:2]

                        bptr = onph.to_array(B)

                        permuted_data = np.array(
                            [bptr[k * w + j] for j in range(w) for k in range(h)],
                            np.float32,
                        )

                        B.dims[0] = w
                        B.dims[1] = h

                        if B.raw_data:
                            B.raw_data = permuted_data.tobytes()
                        else:
                            for idx, val in enumerate(permuted_data):
                                B.float_data[idx] = val

                        # Reduce
                        node.op_type = "noop_reducednccn"
                        self.node_reference[node.input[0]] -= 1

                        reduced_node_count[0] += 1
                        i += 1

    def fuse_shufflechannel(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # ShuffleChannel <= Reshape - Transpose - Reshape
            # ShuffleChannel <= Reshape - Transpose - Constant - Reshape
            if node.op_type == "Reshape":
                if self.node_reference[node.output[0]] == 1:
                    if len(node.input) == 1:
                        shape = self.get_node_attr_ai(node, "shape")
                    else:
                        # Skip weight reshape
                        if node.input[1] not in self.weights:
                            continue
                        shape = self.get_node_attr_from_input_ai(
                            self.weights[node.input[1]]
                        )

                    # 1 groups channels_per_group, height, width
                    # reverse style = channels_per_group, groups, height * width
                    if (
                        (shape.size != 5 and shape.size != 3)
                        or (shape.size == 5 and shape[0] != 1)
                        or (i + 2 >= node_count)
                    ):
                        continue

                    node2 = self.mutable_graph_nodes[i + 1]
                    node3 = self.mutable_graph_nodes[i + 2]

                    if node3.op_type == "Constant":
                        if i + 3 >= node_count:
                            continue
                        node3 = self.mutable_graph_nodes[i + 3]
                    if (node2.op_type != "Transpose" or node3.op_type != "Reshape") or (
                        self.node_reference[node2.output[0]] != 1
                    ):
                        continue

                    # 0 2 1 3 4
                    # reverse style = 1 0 2
                    perm = self.get_node_attr_ai(node2, "perm")
                    if perm.size != 5 and perm.size != 3:
                        continue
                    if perm.size == 5 and (
                        perm[0] != 0
                        or perm[1] != 2
                        or perm[2] != 1
                        or perm[3] != 3
                        or perm[3] != 4
                    ):
                        continue
                    if perm.size == 3 and (
                        perm[0] != 1 or perm[1] != 0 or perm[2] != 2
                    ):
                        continue

                    if len(node3.input) == 1:
                        shape3 = self.get_node_attr_ai(node3, "shape")
                    else:
                        if node3.input[1] not in self.weights:
                            continue
                        shape3 = self.get_node_attr_from_input_ai(
                            self.weights[node3.input[1]]
                        )

                    # 1, -1, height, width
                    # reverse style = group, -1, channels_per_group, height, width
                    if shape3.size != 4 and shape3.size != 5:
                        continue
                    if shape3.size == 4 and (
                        shape3[0] != 1
                        or (shape3[1] != -1 and shape3[1] != shape[1] * shape[2])
                    ):
                        continue
                    if shape3.size == 5 and (
                        shape3[0] != shape[1]
                        or shape3[2] != shape[0]
                        or shape3[3] * shape3[4] != shape[2]
                    ):
                        continue

                    # Reduce
                    node.op_type = "noop_reducedncnn"
                    node2.op_type = "noop_reducedncnn"

                    if len(node.input) == 2:
                        self.node_reference[node.input[1]] -= 1
                    self.node_reference[node.output[0]] -= 1
                    self.node_reference[node2.output[0]] -= 1
                    if len(node3.input) == 2:
                        self.node_reference[node3.input[1]] -= 1

                    del self.blob_names[node.output[0]]
                    del self.blob_names[node2.output[0]]

                    node3.op_type = "ShuffleChannel"
                    node3.input[0] = node.input[0]

                    attr_group = onnx.AttributeProto(
                        name="group", i=shape[1], type=APT.INT
                    )
                    node3.attribute.append(attr_group)

                    attr_reverse = onnx.AttributeProto(
                        name="reverse", i=int(shape.size == 3), type=APT.INT
                    )
                    node3.attribute.append(attr_reverse)

                    reduced_node_count[0] += 2
                    i += 2

    def fuse_shufflechannel_split(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # Split <= ShuffleChannel(reverse type) - Gather(0) - Gather(1)
            if node.op_type == "ShuffleChannel":
                # reverse = 1
                reverse = self.get_node_attr_i(node, "reverse")
                if reverse != 1 or (i + 2 >= node_count):
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]

                if node2.op_type != "Gather" or node3.op_type != "Gather":
                    continue
                if node2.input[0] != node.output[0] or node3.input[0] != node.output[0]:
                    continue

                # axis = 0 or indices = 0
                gather2_axis = self.get_node_attr_i(node2, "axis")
                if gather2_axis != 0 or node2.input[1] not in self.weights:
                    continue

                gather2_indices = self.get_node_attr_from_input_ai(
                    self.weights[node2.input[1]]
                )
                if gather2_indices.size != 1 or gather2_indices[0] != 0:
                    continue

                # axis = 0 or indices = 1
                gather3_axis = self.get_node_attr_i(node3, "axis")
                if gather3_axis != 0 or node3.input[1] not in self.weights:
                    continue

                gather3_indices = self.get_node_attr_from_input_ai(
                    self.weights[node3.input[1]]
                )
                if gather3_indices.size != 1 or gather2_indices[0] != 1:
                    continue

                # reduce
                node2.op_type = "noop_reducedncnn"

                self.node_reference[node.output[0]] -= 2
                self.node_reference[node2.input[1]] -= 1
                self.node_reference[node3.input[1]] -= 1

                node3.op_type = "Split"
                node3.ClearField("input")
                node3.input.append(node.output[0])
                node3.output.append(node3.output[0])
                node3.output[0] = node2.output[0]

                node3.ClearField("attribute")
                attr_axis = onnx.AttributeProto(name="axis", i=1, type=APT.INT)
                node3.attribute.append(attr_axis)

                reduced_node_count[0] += 1
                i += 1

    def fuse_hardswish(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # HardSwish <= Add(+3) - Clip(0, 6) - Mul(X, ) - Div( / 6)
            # HardSwish <= Add(+3) - Clip(0, 6) - Mul(X, ) - Mul(*(1 / 6))
            # HardSwish <= Add(+3) - Clip(0, 6) - Mul(X, ) - Constant - Div( / 6)
            # HardSwish <= Add(+3) - Clip(0, 6) - Mul(X, ) - Constant - Mul(*(1 / 6))
            # out = x * F.relu6(x + 3, inplace=True) / 6
            if node.op_type == "Add":
                if (
                    self.node_reference[node.output[0]] != 1
                    or i + 3 >= node_count
                    or node.input[1] not in self.weights
                ):
                    continue

            add_three = self.weights[node.input[1]]
            if (
                len(add_three.dims) != 0
                or self.get_tensor_proto_data_size(add_three) != 1
            ):
                continue

            constant_add_three = self.get_node_attr_from_input_f(add_three)
            if constant_add_three != 3:
                continue

            node2 = self.mutable_graph_nodes[i + 1]
            node3 = self.mutable_graph_nodes[i + 2]
            node4 = self.mutable_graph_nodes[i + 3]

            if node4.op_type == "Constant":
                if i + 4 >= node_count:
                    continue
                node4 = self.mutable_graph_nodes[i + 4]
            if (
                node2.op_type != "Clip"
                or node3.op_type != "Mul"
                or node4.op_type != "Div"
                or node4.op_type != "Mul"
            ):
                continue
            if self.node_reference[node2.output[0]] != 1:
                continue

            if len(node2.input) == 1:
                relu6_min = self.get_node_attr_f(node2, "min", -FLOAT32_MAX)
                relu6_max = self.get_node_attr_f(node2, "max", FLOAT32_MAX)
            else:
                min_tp = self.weights[node2.input[1]]
                max_tp = self.weights[node2.input[2]]
                relu6_min = self.get_node_attr_from_input_f(min_tp)
                relu6_max = self.get_node_attr_from_input_f(max_tp)

            if relu6_min != 0 or relu6_max != 6:
                continue
            if self.node_reference[node3.output[0]] != 1:
                continue
            if node3.input[0] != node.input[0] or node3.input[1] != node2.output[0]:
                continue
            if node4.input[1] not in self.weights:
                continue

            div_six = self.weights[node4.input[1]]
            if len(div_six.dims) != 0 or self.get_tensor_proto_data_size(div_six) != 1:
                continue

            constant_div_six = self.get_node_attr_from_input_f(div_six)
            if (node4.op_type == "Div" and constant_div_six != 6) or (
                node4.op_type == "Mul" and constant_div_six != 1 / 6
            ):
                continue

            # reduce
            node.op_type = "noop_reducedncnn"
            node2.op_type = "noop_reducedncnn"
            node3.op_type = "noop_reducedncnn"

            self.node_reference[node.input[0]] -= 1
            self.node_reference[node.input[1]] -= 1
            self.node_reference[node.output[0]] -= 1
            if len(node2.input) == 3:
                self.node_reference[node2.input[1]] -= 1
                self.node_reference[node2.input[2]] -= 1
            self.node_reference[node2.output[0]] -= 1
            self.node_reference[node3.output[0]] -= 1
            self.node_reference[node4.input[1]] -= 1

            del self.blob_names[node.output[0]]
            del self.blob_names[node2.output[0]]
            del self.blob_names[node3.output[0]]

            node4.op_type = "HardSwish"
            node4.ClearField("input")
            node4.input.append(node.input[0])

            attr_alpha = onnx.AttributeProto(name="alpha", f=1 / 6, type=APT.FLOAT)
            node4.attribute.append(attr_alpha)

            attr_beta = onnx.AttributeProto(name="beta", f=0.5, type=APT.FLOAT)
            node4.attribute.append(attr_beta)

            reduced_node_count[0] += 3
            i += 3

        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # HardSwish <= HardSigmoid - Mul
            # out = x * hsigmoid(x)
            if node.op_type == "HardSigmoid":
                if self.node_reference[node.output[0]] != 1:
                    continue

                alpha = self.get_node_attr_f(node, "alpha", 0.2)
                beta = self.get_node_attr_f(node, "beta", 0.5)

                if i + 1 >= node_count:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]

                if node2.op_type != "Mul":
                    continue
                if node2.input[0] != node.input[0] or node2.input[1] != node.output[0]:
                    continue

                # reduce
                node.op_type = "noop_reducedncnn"

                self.node_reference[node.input[0]] -= 1
                self.node_reference[node.output[0]] -= 1

                del self.blob_names[node.output[0]]

                node2.op_type = "HardSwish"
                node2.ClearField("input")
                node2.input.append(node.input[0])

                attr_alpha = onnx.AttributeProto(name="alpha", f=alpha, type=APT.FLOAT)
                node2.attribute.append(attr_alpha)

                attr_beta = onnx.AttributeProto(name="beta", f=beta, type=APT.FLOAT)
                node2.attribute.append(attr_beta)

                reduced_node_count[0] += 1
                i += 1

    def fuse_hardsigmoid(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # HardSigmoid <= Add(+3) - Clip(0, 6) - Div( / 6)
            # HardSigmoid <= Add(+3) - Clip(0, 6) - Mul(*(1 / 6))
            # HardSigmoid <= Add(+3) - Clip(0, 6) - Constant - Div( / 6)
            # HardSigmoid <= Add(+3) - Clip(0, 6) - Constant - Mul(*(1 / 6))
            # out = F.relu6(x + 3, inplace=True) / 6
            if node.op_type == "Add":
                if (
                    self.node_reference[node.output[0]] != 1
                    or i + 2 >= node_count
                    or node.input[1] not in self.weights
                ):
                    continue

                add_three = self.weights[node.input[1]]
                if (
                    len(add_three.dims) != 0
                    or self.get_tensor_proto_data_size(add_three) != 1
                ):
                    continue

                constant_add_three = self.weights[node.input[1]]
                if constant_add_three != 3:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]

                if node3.op_type == "Constant":
                    if i + 3 >= node_count:
                        continue
                    node3 = self.mutable_graph_nodes[i + 3]

                if node2.op_type != "Clip" or (
                    node3.op_type != "Div" and node.op_type != "Mul"
                ):
                    continue

                if self.node_reference[node2.output[0]] != 1:
                    continue

                if len(node2.input) == 1:
                    relu6_min = self.get_node_attr_f(node2, "min", -FLOAT32_MAX)
                    relu6_max = self.get_node_attr_f(node2, "max", FLOAT32_MAX)
                else:
                    min_tp = self.weights[node2.input[1]]
                    max_tp = self.weights[node2.input[2]]
                    relu6_min = self.get_node_attr_from_input_f(min_tp)
                    relu6_max = self.get_node_attr_from_input_f(max_tp)

                if relu6_min != 0 or relu6_max != 6:
                    continue
                if node3.input[1] not in self.weights:
                    continue

                div_six = self.weights[node3.input[1]]
                if (
                    len(div_six.dims) != 0
                    or self.get_tensor_proto_data_size(div_six) != 1
                ):
                    continue

                constant_div_six = self.get_node_attr_from_input_f(div_six)
                if (
                    (node3.op_type == "Div" and constant_div_six != 6)
                    or node3.op_type == "Mul"
                    and constant_div_six != 1 / 6
                ):
                    continue

                # reduce
                node.op_type = "noop_reducedncnn"
                node2.op_type = "noop_reducedncnn"

                self.node_reference[node.input[1]] -= 1
                self.node_reference[node.output[0]] -= 1
                if len(node2.input) == 3:
                    self.node_reference[node2.input[1]] -= 1
                    self.node_reference[node2.input[2]] -= 1
                self.node_reference[node2.output[0]] -= 1
                self.node_reference[node3.input[1]] -= 1

                del self.blob_names[node.output[0]]
                del self.blob_names[node2.output[0]]

                node3.op_type = "HardSigmoid"
                node3.ClearField("input")
                node3.input.append(node.input[0])

                attr_alpha = onnx.AttributeProto(name="alpha", f=1 / 6, type=APT.FLOAT)
                node3.attribute.append(attr_alpha)

                attr_beta = onnx.AttributeProto(name="beta", f=0.5, type=APT.FLOAT)
                node3.attribute.append(attr_beta)

                reduced_node_count[0] += 2
                i += 2

    def fuse_swish(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # Swish <= Sigmoid - Mul
            # x * torch.sigmoid(x)
            if node.op_type == "Sigmoid":
                if self.node_reference[node.output[0]] != 1 or i + 1 >= node_count:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]

                if node2.op_type != "Mul":
                    continue
                if node2.input[0] != node.input[0] or node2.input[1] != node.output[0]:
                    continue

                # reduce
                node.op_type("noop_reducedncnn")

                self.node_reference[node.input[0]] -= 1
                self.node_reference[node.output[0]] -= 1

                del self.blob_names[node.output[0]]

                node2.op_type = "Swish"
                node2.ClearField("input")
                node2.input.append(node.input[0])

                reduced_node_count[0] += 1
                i += 1

    def fuse_batchnorm1d_squeeze_unsqueeze(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # BatchNormalization <= Unsqueeze - BatchNormalization - Squeeze
            if node.op_type == "Unsqueeze":
                if self.node_reference[node.output[0]] != 1 or i + 2 >= node_count:
                    continue

            node2 = self.mutable_graph_nodes[i + 1]
            node3 = self.mutable_graph_nodes[i + 2]

            if node2.op_type != "BatchNormalization" or node3.op_type != "Squeeze":
                continue
            if self.node_reference[node2.output[0]] != 1:
                continue
            if node2.input[0] != node.output[0] or node3.input[0] != node2.output[0]:
                continue

            # reduce
            node.op_type = "noop_reducedncnn"
            node3.op_type = "noop_reducedncnn"

            self.node_reference[node.output[0]] -= 1
            self.node_reference[node2.output[0]] -= 1

            del self.blob_names[node.output[0]]
            del self.blob_names[node2.output[0]]

            node2.input[0] = node.input[0]
            node2.output[0] = node3.output[0]

            reduced_node_count[0] += 2
            i += 2

    def fuse_unsqueeze_prelu(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # PReLU <= Unsqueeze - PReLU
            if node.op_type == "Unsqueeze":
                # check weight
                if node.input[0] not in self.weights:
                    continue

                B = self.weights[node.input[0]]
                if len(B.dims) != 1:
                    continue
                if self.node_reference[node.output[0]] != 1:
                    continue

                # axes = (1, 2)
                axes = self.get_node_attr_ai(node, "axes")
                if axes.size != 2 or axes[0] != 1 or axes[1] != 2:
                    continue
                if i + 1 >= node_count:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]

                if node2.op_type != "PRelu" or node2.input[1] != node.output[0]:
                    continue

                # reduce
                node.op_type = "noop_reducedncnn"

                self.node_reference[node.output[0]] -= 1

                del self.blob_names[node.output[0]]

                node2.input[1] = node.input[0]

                reduced_node_count[0] += 1
                i += 1

    def fuse_normalize(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # Normalize <= X - ReduceL2 - Clip - Expand - Div
            # Normalize <= X - ReduceL2 - Clip - Shape - Expand - Div
            if node.op_type == "ReduceL2":
                if self.node_reference[node.output[0]] != 1:
                    continue

                # axes = (1)
                axes = self.get_node_attr_ai(node, "axes")
                if len(axes) != 1 or axes[0] != 1 or i + 3 >= node_count:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]
                node4 = self.mutable_graph_nodes[i + 3]

                has_shape_node = node3.op_type == "Shape"
                if has_shape_node:
                    if i + 4 >= node_count:
                        continue

                    node_shape = node3
                    node3 = self.mutable_graph_nodes[i + 3]
                    node4 = self.mutable_graph_nodes[i + 4]

                if (
                    node2.op_type != "Clip"
                    or node3.op_type != "Expand"
                    or node4.op_type != "Div"
                ):
                    continue
                if (
                    self.node_reference[node2.output[0]] != 1
                    or self.node_reference[node3.output[0]] != 1
                ):
                    continue
                if (
                    node2.input[0] != node.output[0]
                    or node3.input[0] != node2.output[0]
                    or node4.input[0] != node.input[0]
                    or node4.input[1] != node3.output[0]
                ):
                    continue

                if has_shape_node and (
                    node_shape.input[0] != node.input[0]
                    or node3.input[1] != node_shape.output[0]
                ):
                    continue

                # +eps
                if len(node2.input) == 1:
                    clip_min = self.get_node_attr_f(node2, "min", -FLOAT32_MAX)
                else:
                    min_tp = self.weights[node2.input[1]]
                    clip_min = self.get_node_attr_from_input_f(min_tp)

                # reduce
                node.op_type = "noop_reducedncnn"
                node2.op_type = "noop_reducedncnn"
                if has_shape_node:
                    node_shape.op_type = "noop_reducedncnn"
                node3.op_type = "noop_reducedncnn"

                self.node_reference[node.input[0]] -= 2 if has_shape_node else 1
                self.node_reference[node.output[0]] -= 1
                self.node_reference[node2.output[0]] -= 1
                if has_shape_node:
                    self.node_reference[node_shape.output[0]] -= 1
                self.node_reference[node3.output[0]] -= 1
                if len(node3.input) == 2:
                    self.node_reference[node3.input[1]] -= 1

                del self.blob_names[node.output[0]]
                del self.blob_names[node2.output[0]]
                if has_shape_node:
                    del self.blob_names[node_shape.output[0]]
                del self.blob_names[node3.output[0]]

                node4.op_type = "Normalize"
                node4.ClearField("input")
                node4.input.append(node.input[0])

                attr_alpha = onnx.AttributeProto(name="eps", f=clip_min, type=APT.FLOAT)
                node4.attribute.append(attr_alpha)

                reduced_node_count[0] += 4 if has_shape_node else 3
                i += 4 if has_shape_node else 3

    def fuse_groupnorm(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # GroupNorm <= X - Reshape - InstanceNormalization - Reshape - Mul - Add
            if node.op_type == "Reshape":
                if self.node_reference[node.output[0]] != 1:
                    continue

                if len(node.input) == 1:
                    shape = self.get_node_attr_ai(node, "shape")
                else:
                    # Skip weight reshape
                    if node.input[1] not in self.weights:
                        continue

                    shape = self.get_node_attr_from_input_ai(
                        self.weights[node.input[1]]
                    )

                # 0, group, -1
                if (
                    shape.size != 3
                    or shape[0] != 0
                    or shape[2] != -1
                    or i + 4 >= node_count
                ):
                    continue

                groups = shape[1]

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]
                node4 = self.mutable_graph_nodes[i + 3]
                node5 = self.mutable_graph_nodes[i + 4]

                if (
                    node2.op_type != "InstanceNormalization"
                    or node3.op_type != "Reshape"
                    or node4.op_type != "Mul"
                    or node5.op_type != "Add"
                ):
                    continue
                if (
                    self.node_reference[node2.output[0]] != 1
                    or self.node_reference[node3.output[0]] != 1
                    or self.node_reference[node4.output[0]] != 1
                ):
                    continue
                if (
                    node2.input[0] != node.output[0]
                    or node3.input[0] != node2.output[0]
                    or node4.input[0] != node3.output[0]
                    or node5.input[0] != node4.output[0]
                ):
                    continue

                # +eps
                eps = self.get_node_attr_f(node2, "epsilon", 0.00001)

                # InstanceNormalization S=1 B=0
                S = self.get_node_attr_from_input_af(self.weights[node2.input[1]])
                B = self.get_node_attr_from_input_af(self.weights[node2.input[2]])
                if S.size != groups or B.size != groups:
                    continue

                instancenorm_affine = False
                for j in range(groups):
                    if S[j] != 1 or B[j] != 0:
                        instancenorm_affine = True
                        break

                if instancenorm_affine:
                    continue

                if len(node3.input) == 1:
                    shape2 = self.get_node_attr_ai(node3, "shape")
                else:
                    # Skip weight reshape
                    if node3.input[1] not in self.weights:
                        continue

                    shape2 = self.get_node_attr_from_input_ai(
                        self.weights[node3.input[1]]
                    )

                # 1, channels, w, h
                if shape2.size != 4 or shape2[0] != 1:
                    continue

                channels = shape2[1]

                # affine
                affine_S = self.get_node_attr_from_input_af(
                    self.weights[node4.input[1]]
                )
                affine_B = self.get_node_attr_from_input_af(
                    self.weights[node5.input[1]]
                )
                if affine_S.size != channels and affine_B != channels:
                    continue  # only per-channel affine allowed

                # reduce
                node.op_type = "noop_reducedncnn"
                node2.op_type = "noop_reducedncnn"
                node3.op_type = "noop_reducedncnn"
                node4.op_type = "noop_reducedncnn"

                if len(node.input) == 2:
                    self.node_reference[node.input[1]] -= 1
                self.node_reference[node.output[0]] -= 1
                self.node_reference[node2.input[1]] -= 1
                self.node_reference[node2.input[2]] -= 1
                self.node_reference[node2.output[0]] -= 1
                if len(node3.input) == 2:
                    self.node_reference[node3.input[1]] -= 1
                self.node_reference[node3.output[0]] -= 1
                self.node_reference[node4.output[0]] -= 1

                del self.blob_names[node.output[0]]
                del self.blob_names[node2.output[0]]
                del self.blob_names[node3.output[0]]
                del self.blob_names[node4.output[0]]

                affine_scale = node4.input[1]
                affine_bias = node5.input[1]

                node5.op_type = "GroupNorm"
                node5.ClearField("input")
                node5.input.append(node.input[0])
                node5.input.append(affine_scale)
                node5.input.append(affine_bias)

                attr_groups = onnx.AttributeProto(name="groups", i=groups, type=APT.INT)
                node5.attribute.append(attr_groups)

                attr_channels = onnx.AttributeProto(
                    name="channels", i=channels, type=APT.INT
                )
                node5.attribute.append(attr_channels)

                attr_eps = onnx.AttributeProto(name="epsilon", f=eps, type=APT.FLOAT)
                node5.attribute.append(attr_eps)

                attr_affine = onnx.AttributeProto(name="affine", i=1, type=APT.INT)
                node5.attribute.append(attr_affine)

                reduced_node_count[0] += 4
                i += 4

    def fuse_layernorm(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # LayerNorm <= X - ReduceMean - Sub - Pow - ReduceMean - Add - Sqrt - Div
            # LayerNorm <= X - ReduceMean - Sub - Pow - ReduceMean - Add - Sqrt - Div - Mul - Add
            if node.op_type == "ReduceMean":
                if self.node_reference[node.output[0]] != 1:
                    continue

                axes = self.get_node_attr_ai(node, "axes")

                # -1
                # -2 -1
                if axes.size != 1 and axes.size != 2:
                    continue
                if (axes.size == 1 and axes[0] != -1) or (
                    axes.size == 2 and (axes[0] != -2 or axes[1] != -1)
                ):
                    continue
                if i + 6 >= node_count:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]
                node4 = self.mutable_graph_nodes[i + 3]
                node5 = self.mutable_graph_nodes[i + 4]
                node6 = self.mutable_graph_nodes[i + 5]
                node7 = self.mutable_graph_nodes[i + 6]

                if node2.op_type != "Sub" or node3.op_type != "Pow":
                    continue
                if (
                    self.node_reference[node2.output[0]] != 2
                    or self.node_reference[node3.output[0]] != 1
                    or self.node_reference[node4.output[0]] != 1
                    or self.node_reference[node5.output[0]] != 1
                    or self.node_reference[node6.output[0]] != 1
                ):
                    continue
                if (
                    node2.input[0] != node.output[0]
                    or node2.input[1] != node.output[0]
                    or node3.input[0] != node2.output[0]
                    or node4.input[0] != node3.output[0]
                    or node5.input[0] != node4.output[0]
                    or node6.input[0] != node5.output[0]
                    or node7.input[0] != node2.output[0]
                    or node7.input[1] != node6.output[0]
                ):
                    continue
                if node3.input[1] not in self.weights:
                    continue

                pow_two = self.weights[node3.input[1]]
                if (
                    len(pow_two.dims) != 0
                    or self.get_tensor_proto_data_size(pow_two) != 1
                ):
                    continue

                constant_pow_two = self.get_node_attr_from_input_f(pow_two)
                if constant_pow_two != 2:
                    continue

                axes4 = self.get_node_attr_ai(node4, "axes")

                # -1
                # -2 -1
                if axes4.size != axes.size:
                    continue
                if (axes.size == 1 and axes[4] != -1) or (
                    axes.size == 2 and (axes4[0] != -2 or axes4[1] != -1)
                ):
                    continue
                if node5.input[1] not in self.weights:
                    continue

                add_eps = self.weights[node5.input[1]]
                if (
                    len(add_eps.dims) != 0
                    or self.get_tensor_proto_data_size(add_eps) != 1
                ):
                    continue

                eps = self.get_node_attr_from_input_f(add_eps)

                affine = 0
                while i + 8 < node_count:
                    node8 = self.mutable_graph_nodes[i + 7]
                    node9 = self.mutable_graph_nodes[i + 8]

                    if node8.op_type != "Mul" or node9.op_type != "Add":
                        break
                    if (
                        self.node_reference[node7.output[0]] != 1
                        or self.node_reference[node8.output[0]] != 1
                    ):
                        break
                    if (
                        node8.input[0] != node7.output[0]
                        or node9.input[0] != node8.output[0]
                    ):
                        break

                    # affine
                    affine_S = self.get_node_attr_from_input_af(
                        self.weights[node8.input[1]]
                    )
                    affine_B = self.get_node_attr_from_input_af(
                        self.weights[node9.input[1]]
                    )
                    if affine_S.size != affine_B.size:
                        break

                    affine = 1
                    break

                # reduce
                node.op_type = "noop_reducedncnn"
                node2.op_type = "noop_reducedncnn"
                node3.op_type = "noop_reducedncnn"
                node4.op_type = "noop_reducedncnn"
                node5.op_type = "noop_reducedncnn"
                node6.op_type = "noop_reducedncnn"

                self.node_reference[node2.input[0]] -= 1
                self.node_reference[node2.input[1]] -= 1
                self.node_reference[node3.input[0]] -= 1
                self.node_reference[node3.input[1]] -= 1
                self.node_reference[node4.input[0]] -= 1
                self.node_reference[node5.input[0]] -= 1
                self.node_reference[node5.input[1]] -= 1
                self.node_reference[node6.input[0]] -= 1
                self.node_reference[node7.input[0]] -= 1
                self.node_reference[node7.input[1]] -= 1

                del self.blob_names[node.output[0]]
                del self.blob_names[node2.output[0]]
                del self.blob_names[node3.output[0]]
                del self.blob_names[node4.output[0]]
                del self.blob_names[node5.output[0]]
                del self.blob_names[node6.output[0]]

                attr_eps = onnx.AttributeProto(name="epsilon", f=eps, type=APT.FLOAT)
                attr_affine = onnx.AttributeProto(name="affine", i=affine, type=APT.INT)
                if affine == 0:
                    node7.op_type = "LayerNorm"
                    node7.ClearField("input")
                    node7.input.append(node.input[0])

                    node7.attribute.append(attr_eps)
                    node7.attribute.append(attr_affine)

                    reduced_node_count[0] += 6
                    i += 6
                else:
                    # This is probably unnecessary on their part, but I'm paranoid
                    node8 = self.mutable_graph_nodes[i + 7]
                    node9 = self.mutable_graph_nodes[i + 8]

                    node7.op_type = "noop_reducedncnn"
                    node8.op_type = "noop_reducedncnn"

                    self.node_reference[node8.input[0]] -= 1
                    self.node_reference[node9.input[0]] -= 1

                    del self.blob_names[node7.output[0]]
                    del self.blob_names[node8.output[0]]

                    affine_scale = node8.input[1]
                    affine_bias = node9.input[1]

                    node9.op_type = "LayerNorm"
                    node9.ClearField("input")
                    node9.input.append(node.input[0])
                    node9.input.append(affine_scale)
                    node9.input.append(affine_bias)

                    node9.attribute.append(attr_eps)
                    node9.attribute.append(attr_affine)

                    reduced_node_count[0] += 8
                    i += 8

    def fuse_flatten(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # Flatten <= X - Shape - Gather - Constant - Unsqueeze - Unsqueeze - Concat - Reshape
            if node.op_type == "Shape":
                if self.node_reference[node.output[0]] != 1:
                    continue
                if i + 6 >= node_count:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]
                node4 = self.mutable_graph_nodes[i + 3]
                node5 = self.mutable_graph_nodes[i + 4]
                node6 = self.mutable_graph_nodes[i + 5]
                node7 = self.mutable_graph_nodes[i + 6]

                if (
                    node2.op_type != "Gather"
                    or node3.op_type != "Constant"
                    or node4.op_type != "Unsqueeze"
                    or node5.op_type != "Unsqueeze"
                    or node6.op_type != "Concat"
                    or node7.op_type != "Reshape"
                ):
                    continue
                if (
                    self.node_reference[node2.output[0]] != 1
                    or self.node_reference[node4.output[0]] != 1
                    or self.node_reference[node5.output[0]] != 1
                    or self.node_reference[node6.output[0]] != 1
                ):
                    continue

                if (
                    node2.input[0] != node.output[0]
                    or node4.input[0] != node2.output[0]
                    or node5.input[0] != node3.output[0]
                    or node6.input[0] != node4.output[0]
                    or node6.input[1] != node5.output[0]
                    or node7.input[0] != node.input[0]
                    or node7.input[1] != node6.output[0]
                ):
                    continue

                # axis = 0
                gather_axis = self.get_node_attr_i(node2, "axis")
                if gather_axis != 0:
                    continue

                # indices = 0
                if node2.input[1] not in self.weights:
                    continue

                gather_indices = self.get_node_attr_from_input_ai(
                    self.weights[node2.input[1]]
                )
                if gather_indices.size != 1 or gather_indices[0] != 0:
                    continue

                # axes = (0)
                unsqueeze_axes = self.get_node_attr_ai(node4, "axes")
                if unsqueeze_axes.size != 1 or unsqueeze_axes[0] != 0:
                    continue
                unsqueeze_axes2 = self.get_node_attr_ai(node5, "axes")
                if unsqueeze_axes2.size != 1 or unsqueeze_axes2[0] != 0:
                    continue

                # data = -1
                if node5.input[0] not in self.weights:
                    continue

                unsqueeze2_data = self.get_node_attr_from_input_ai(
                    self.weights[node5.input[0]]
                )
                if unsqueeze2_data.size != 1 or unsqueeze2_data[0] != -1:
                    continue

                # axis = 0
                concat_axis = self.get_node_attr_i(node6, "axis")
                if concat_axis != 0:
                    continue

                # reduce
                node.op_type = "noop_reducedncnn"
                node2.op_type = "noop_reducedncnn"
                node4.op_type = "noop_reducedncnn"
                node5.op_type = "noop_reducedncnn"
                node6.op_type = "noop_reducedncnn"

                self.node_reference[node.input[0]] -= 1
                self.node_reference[node.output[0]] -= 1
                self.node_reference[node2.input[1]] -= 1
                self.node_reference[node2.output[0]] -= 1
                self.node_reference[node4.output[0]] -= 1
                self.node_reference[node5.input[0]] -= 1
                self.node_reference[node5.output[0]] -= 1
                self.node_reference[node.output[0]] -= 1

                del self.blob_names[node.output[0]]
                del self.blob_names[node2.output[0]]
                del self.blob_names[node4.output[0]]
                del self.blob_names[node5.output[0]]
                del self.blob_names[node6.output[0]]

                node7.op_type = "Flatten"
                node7.ClearField("input")
                node7.input.append(node.input[0])

                reduced_node_count[0] += 5
                i += 5

    def fuse_pixelshuffle(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # PixelShuffle <= Reshape - Transpose - Reshape
            # PixelShuffle <= Reshape - Transpose - Constant - Reshape
            if node.op_type == "Reshape":
                if self.node_reference[node.output[0]] != 1:
                    continue

                if len(node.input) == 1:
                    shape = self.get_node_attr_ai(node, "shape")
                else:
                    # skip weight reshape
                    if node.input[1] not in self.weights:
                        continue

                    shape = self.get_node_attr_from_input_ai(
                        self.weights[node.input[1]]
                    )

                # -1, 3, upscale_factor, upscale_factor, height, width
                if (
                    shape.size != 6
                    or (shape[0] != 1 and shape[0] != -1)
                    or shape[2] != shape[3]
                    or i + 2 >= node_count
                ):
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]

                if node3.op_type == "Constant":
                    if i + 3 >= node_count:
                        continue

                    node3 = self.mutable_graph_nodes[i + 3]

                if node.op_type != "Transpose" or node3.op_type != "Reshape":
                    continue
                if self.node_reference[node2.output[0]] != 1:
                    continue

                # 0 1 4 2 5 3
                perm = self.get_node_attr_ai(node2, "perm")
                if (
                    perm.size != 6
                    or perm[0] != 0
                    or perm[1] != 1
                    or perm[2] != 4
                    or perm[3] != 2
                    or perm[4] != 5
                    or perm[5] != 3
                ):
                    continue

                if len(node3.input) == 1:
                    shape3 = self.get_node_attr_ai(node3, "shape")
                else:
                    if node3.input[1] not in self.weights:
                        continue

                    shape3 = self.get_node_attr_from_input_ai(
                        self.weights[node3.input[1]]
                    )

                # -1, 3, height, width
                if (
                    shape3.size != 4
                    or (shape3[0] != 1 and shape3[0] != -1)
                    or shape3[1] != shape[1]
                    or shape3[2] != shape[2] * shape[4]
                    or shape3[3] != shape[3] * shape[5]
                ):
                    continue

                # reduce
                node.op_type = "noop_reducedncnn"
                node2.op_type = "noop_reducedncnn"

                if len(node.input) == 2:
                    self.node_reference[node.input[1]] -= 1
                self.node_reference[node.output[0]] -= 1
                self.node_reference[node2.output[0]] -= 1
                if len(node3) == 2:
                    self.node_reference[node3.input[1]] -= 1

                del self.blob_names[node.output[0]]
                del self.blob_names[node2.output[0]]

                node3.op_type = "PixelShuffle"
                node3.input[0] = node.input[0]

                attr_group = onnx.AttributeProto(
                    name="scale_factor", i=shape[2], type=APT.INT
                )
                node3.attribute.append(attr_group)

                reduced_node_count[0] += 2
                i += 2

    def fuse_reorg(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # PixelShuffle <= Reshape - Transpose - Reshape
            # PixelShuffle <= Reshape - Transpose - Constant - Reshape
            if node.op_type == "Reshape":
                if self.node_reference[node.output[0]] != 1:
                    continue

                if len(node.input) == 1:
                    shape = self.get_node_attr_ai(node, "shape")
                else:
                    if node.input[1] not in self.weights:
                        continue

                    shape = self.get_node_attr_from_input_ai(
                        self.weights[node.input[1]]
                    )

                # -1, 3, out_height, block_size, out_width, block_size
                if (
                    shape.size != 6
                    or (shape[0] != 1 and shape[0] != -1)
                    or shape[3] != shape[5]
                    or i + 2 >= node_count
                ):
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]

                if node3.op_type == "Constant":
                    if i + 3 >= node_count:
                        continue

                    node3 = self.mutable_graph_nodes[i + 3]

                if node2.op_type != "Transpose" or node3.op_type != "Reshape":
                    continue
                if self.node_reference[node2.output[0]] != 1:
                    continue

                # 0 1 3 5 2 4
                perm = self.get_node_attr_ai(node2, "perm")
                if (
                    perm.size != 6
                    or perm[0] != 0
                    or perm[1] != 1
                    or perm[2] != 3
                    or perm[3] != 5
                    or perm[4] != 2
                    or perm[5] != 4
                ):
                    continue

                if len(node3.input) == 1:
                    shape3 = self.get_node_attr_ai(node3, "shape")
                else:
                    if node3.input[1] not in self.weights:
                        continue

                    shape3 = self.get_node_attr_from_input_ai(
                        self.weights[node3.input[1]]
                    )

                # -1, out_channels, out_height, out_width
                if (
                    shape3.size != 4
                    or (shape3[0] != 1 and shape3[0] != -1)
                    or shape3[1] != shape[1] * shape[3] * shape[5]
                    or shape3[2] != shape[2]
                    or shape3[3] != shape[4]
                ):
                    continue

                # reduce
                node.op_type = "noop_reducedncnn"
                node2.op_type = "noop_reducedncnn"

                if len(node.input) == 2:
                    self.node_reference[node.input[1]] -= 1
                self.node_reference[node.output[0]] -= 1
                self.node_reference[node2.output[0]] -= 1
                if len(node3) == 2:
                    self.node_reference[node3.input[1]] -= 1

                del self.blob_names[node.output[0]]
                del self.blob_names[node2.output[0]]

                node3.op_type = "Reorg"
                node3.input[0] = node.input[0]

                attr_group = onnx.AttributeProto(
                    name="stride", i=shape[3], type=APT.INT
                )
                node3.attribute.append(attr_group)

                reduced_node_count[0] += 2
                i += 2

    def fuse_expand_broadcast(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # Add/Sub/Mul/Div/Min/Max <= Expand - Add/Sub/Mul/Div/Min/Max
            if node.op_type == "Expand":
                if self.node_reference[node.output[0]] != 1 or i + 1 >= node_count:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]

                if node2.op_type not in ["Add", "Sub", "Mul", "Div", "Min", "Max"]:
                    continue
                if (
                    node2.input[1] != node.output[0]
                    and node2.input[0] != node.output[0]
                ):
                    continue

                # reduce
                node.op_type = "noop_reducedncnn"

                self.node_reference[node.output[0]] -= 1
                if len(node.input) == 2:
                    self.node_reference[node.input[1]] -= 1

                del self.blob_names[node.output[0]]

                if node2.input[0] == node.output[0]:
                    node2.input[0] = node.input[0]
                else:
                    node2.input[1] = node.input[0]

                reduced_node_count[0] += 1
                i += 1

    def fuse_lstm_gru_rnn(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

    def fuse_multiheadattention(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

    def fuse_binaryop_with_scalar(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

    def convert(self):
        # Topological sort
        for i, node in enumerate(self.mutable_graph_nodes):
            swapnode = False
            missing_input_name = None
            for input_name in node.input:
                if (
                    input_name
                    and input_name not in self.producers
                    and input_name not in self.weights
                ):
                    swapnode = True
                    missing_input_name = input_name
                    break

            # If nothing missing, add outputs to producers and continue
            # to next node
            if not swapnode:
                for output_name in node.output:
                    if output_name:
                        self.producers[output_name] = None

                continue

            # find node that produce missing_input_name
            for j, nodeq in enumerate(self.mutable_graph_nodes, i + 1):
                found = False
                for output_name in nodeq.output:
                    if output_name == missing_input_name:
                        found = True
                        break

                if found:
                    break
            else:
                raise RuntimeError(
                    f"Cannot find node that produces {missing_input_name}, "
                    f"which is required by node {i} ({node.name})."
                )

            self.swap_nodes(i, j)

        # global definition line
        # [layer count][blob count]
        for i, node in enumerate(self.mutable_graph_nodes):
            op = node.op_type
            node.name = node.name if node.name else node.output[0]

            if op == "Constant":
                self.weights[node.output[0]] = self.get_node_attr_tensor(node, "value")

            for input_name in node.input:
                self.blob_names[input_name] = None

                if input_name not in self.node_reference:
                    self.node_reference[input_name] = 1
                else:
                    self.node_reference[input_name] += 1

            if op == "Dropout":
                output_name = node.output[0]
                self.blob_names[output_name] = None
                self.node_reference[output_name] = 0
                continue

            for output_name in node.output:
                self.blob_names[output_name] = None
                self.node_reference[output_name] = 0

        # include Input node
        input_node_count = 0
        for graph_input in self.onnx_graph.input:
            input_name = graph_input.name

            # check weight
            if input_name not in self.weights:
                self.blob_names[input_name] = None
                input_node_count += 1

        # op chain fusion
        reduced_node_count = [0]
        self.fuse_weight_reshape(reduced_node_count)
        self.fuse_weight_transpose(reduced_node_count)
        self.fuse_shufflechannel(reduced_node_count)
        self.fuse_shufflechannel_split(reduced_node_count)
        self.fuse_hardsigmoid(reduced_node_count)
        self.fuse_hardswish(reduced_node_count)
        self.fuse_swish(reduced_node_count)
        self.fuse_batchnorm1d_squeeze_unsqueeze(reduced_node_count)
        self.fuse_unsqueeze_prelu(reduced_node_count)
        self.fuse_normalize(reduced_node_count)
        self.fuse_groupnorm(reduced_node_count)
        self.fuse_layernorm(reduced_node_count)
        self.fuse_flatten(reduced_node_count)
        self.fuse_pixelshuffle(reduced_node_count)
        self.fuse_reorg(reduced_node_count)
        self.fuse_expand_broadcast(reduced_node_count)
        self.fuse_lstm_gru_rnn(reduced_node_count)
        self.fuse_multiheadattention(reduced_node_count)
        self.fuse_binaryop_with_scalar(reduced_node_count)
        self.fuse_rewrite_gather()


if __name__ == "__main__":
    model = onnx.load_model(
        "D:/Scripts/Python/chaiNNer/onnx_test_models/super-resolution-10.onnx"
    )
    converter = Onnx2NcnnConverter(model)
    converter.convert()
