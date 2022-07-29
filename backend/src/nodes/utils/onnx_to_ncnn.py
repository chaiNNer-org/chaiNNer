from copy import deepcopy
from typing import Union, List, Dict

import numpy as np
import onnx
import onnx.numpy_helper as onph
from google.protobuf.internal.containers import (
    RepeatedCompositeFieldContainer,
    RepeatedScalarFieldContainer,
)
from sanic.log import logger

from ncnn_structure import (
    NcnnModel,
    NcnnLayer,
    UnaryOpTypes,
    BinaryOpTypes,
    EltwiseOpTypes,
)

INT64_MIN, INT64_MAX = np.iinfo(np.int64).min, np.iinfo(np.int64).max
FLOAT32_MAX = np.finfo(np.float32).max


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
UOT = UnaryOpTypes
BOT = BinaryOpTypes
EOT = EltwiseOpTypes


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
        print(f"weights: {len(self.weights)}")
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
                for idx, i in enumerate(attr.ints):
                    v[idx] = max(min(i, INT64_MAX), INT64_MIN)
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
            f = shape_data.item(0)
        elif tp.data_type == TPT.INT64:
            f = max(min(shape_data.item(0), INT64_MAX), INT64_MIN)
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

    def write_tensor_proto_data(self, tp: onnx.TensorProto, layer: NcnnLayer) -> None:
        # TODO: Figure out ncnn structure to decide how to write to it
        size = self.get_tensor_proto_data_size(tp)

        if tp.raw_data:
            layer.weight_data = tp.raw_data
        elif tp.data_type == TPT.FLOAT:
            weight_array = onph.to_array(tp)
            layer.weight_data = weight_array.tobytes()

    def fuse_rewrite_gather(self) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            gather = self.mutable_graph_nodes[i]
            if gather.op_type == "Gather":
                indices = self.get_node_attr_from_input_ai(
                    self.weights[gather.input[1]]
                )
                if len(indices) == 1:
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
                    self.set_node_attr_ai(
                        gather, "ends", np.array([index + 1], np.int32)
                    )
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

                    self.blob_names.pop(node.output[0], None)
                    self.blob_names.pop(node2.output[0], None)

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
                if (
                    len(div_six.dims) != 0
                    or self.get_tensor_proto_data_size(div_six) != 1
                ):
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

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)
                self.blob_names.pop(node3.output[0], None)

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

                self.blob_names.pop(node.output[0], None)

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

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)

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

                self.blob_names.pop(node.output[0], None)

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
                if (
                    node2.input[0] != node.output[0]
                    or node3.input[0] != node2.output[0]
                ):
                    continue

                # reduce
                node.op_type = "noop_reducedncnn"
                node3.op_type = "noop_reducedncnn"

                self.node_reference[node.output[0]] -= 1
                self.node_reference[node2.output[0]] -= 1

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)

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

                self.blob_names.pop(node.output[0], None)

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

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)
                if has_shape_node:
                    self.blob_names.pop(node_shape.output[0], None)
                self.blob_names.pop(node3.output[0], None)

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

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)
                self.blob_names.pop(node3.output[0], None)
                self.blob_names.pop(node4.output[0], None)

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

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)
                self.blob_names.pop(node3.output[0], None)
                self.blob_names.pop(node4.output[0], None)
                self.blob_names.pop(node5.output[0], None)
                self.blob_names.pop(node6.output[0], None)

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

                    self.blob_names.pop(node7.output[0], None)
                    self.blob_names.pop(node8.output[0], None)

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

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)
                self.blob_names.pop(node4.output[0], None)
                self.blob_names.pop(node5.output[0], None)
                self.blob_names.pop(node6.output[0], None)

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

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)

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

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)

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

                self.blob_names.pop(node.output[0], None)

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

            # LSTM(bi) <= LSTM(bi) - Transpose - Reshape - Transpose
            if node.op_type in ["LSTM", "GRU", "RNN"]:
                if self.node_reference[node.output[0]] != 1:
                    continue
                if i + 2 >= node_count:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]

                if node2.op_type != "Transpose" or node3.op_type != "Reshape":
                    continue
                if self.node_reference[node2.output[0]] != 1:
                    continue
                if (
                    node2.input[0] != node.output[0]
                    or node3.input[0] != node2.output[0]
                ):
                    continue

                direction = self.get_node_attr_s(node, "direction")
                if direction != "bidirectional":
                    continue

                # 0 2 1 3
                perm = self.get_node_attr_ai(node2, "perm")
                if (
                    perm.size != 4
                    or perm[0] != 0
                    or perm[1] != 2
                    or perm[2] != 1
                    or perm[3] != 3
                ):
                    continue

                if len(node3.input) == 1:
                    shape = self.get_node_attr_ai(node3, "shape")
                else:
                    if node3.input[1] not in self.weights:
                        continue

                    shape = self.get_node_attr_from_input_ai(
                        self.weights[node3.input[1]]
                    )

                # 0 0 -1
                if shape.size != 3 or shape[0] != 0 or shape[1] != 0 or shape[2] != -1:
                    continue

                # reduce
                node2.op_type = "noop_reducedncnn"
                node3.op_type = "noop_reducedncnn"

                self.node_reference[node.output[0]] -= 1
                self.node_reference[node2.output[0]] -= 1
                if len(node3.input) == 2:
                    self.node_reference[node3.input[1]] -= 1

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)

                node.output[0] = node3.output[0]

                reduced_node_count[0] += 2
                i += 2

                if i + 1 < node_count:
                    if self.node_reference[node3.output[0]] != 1:
                        continue

                    node4 = self.mutable_graph_nodes[i + 1]

                    if node4.op_type != "Transpose":
                        continue
                    if node4.input[0] != node.output[0]:
                        continue

                    # 1 0 2
                    perm4 = self.get_node_attr_ai(node4, "perm")
                    if (
                        perm4.size != 3
                        or perm4[0] != 1
                        or perm4[1] != 0
                        or perm4[2] != 2
                    ):
                        continue

                    # reduce
                    node4.op_type = "noop_reducedncnn"

                    self.node_reference[node.output[0]] -= 1

                    self.blob_names.pop(node.output[0], None)

                    node.output[0] = node4.output[0]

                    reduced_node_count[0] += 1
                    i += 1

        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # LSTM(uni) <= LSTM(uni) - Squeeze - Transpose
            if node.op_type in ["LSTM", "GRU", "RNN"]:
                if self.node_reference[node.output[0]] != 1:
                    continue
                if i + 1 >= node_count:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]

                if node2.op_type != "Squeeze":
                    continue
                if node2.input[0] != node.output[0]:
                    continue

                direction = self.get_node_attr_s(node, "direction")
                if direction == "bidirectional":
                    continue

                axes = self.get_node_attr_ai(node2, "axes")
                if axes.size != 1 or axes[0] != 1:
                    continue

                # reduce
                node2.op_type = "noop_reducedncnn"

                self.node_reference[node.output[0]] -= 1

                self.blob_names.pop(node.output[0], None)

                node.output[0] = node2.output[0]

                reduced_node_count[0] += 1
                i += 1

                if i + 1 < node_count:
                    if self.node_reference[node2.output[0]] != 1:
                        continue

                    node3 = self.mutable_graph_nodes[i + 1]

                    if node3.op_type != "Transpose":
                        continue

                    if node3.input[0] != node.output[0]:
                        continue

                    # 1 0 2
                    perm4 = self.get_node_attr_ai(node3, "perm")
                    if (
                        perm4.size != 3
                        or perm4[0] != 1
                        or perm4[1] != 0
                        or perm4[2] != 2
                    ):
                        continue

                    # reduce
                    node3.op_type = "noop_reducedncnn"

                    self.node_reference[node.output[0]] -= 1

                    self.blob_names.pop(node.output[0], None)

                    node.output[0] = node3.output[0]

                    reduced_node_count[0] += 1
                    i += 1

        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # LSTM <= Transpose - LSTM
            if node.op_type == "Transpose":
                if self.node_reference[node.output[0]] != 1:
                    continue

                # 1 0 2
                perm = self.get_node_attr_ai(node, "perm")
                if perm.size != 3 or perm[0] != 1 or perm[1] != 0 or perm[2] != 2:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]

                if node2.op_type not in ["LSTM", "GRU", "RNN"]:
                    continue
                if node2.input[0] != node.output[0]:
                    continue

                # reduce
                node.op_type = "noop_reducedncnn"

                self.node_reference[node.output[0]] -= 1

                self.blob_names.pop(node.output[0], None)

                node2.input[0] = node.input[0]

                reduced_node_count[0] += 1
                i += 1

    def fuse_multiheadattention(self, reduced_node_count: [int]) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # MultiHeadAttention <= MatMul(q) - Add
            #                      - MatMul(k) - Add
            #                      - MatMul(v) - Add
            #                      - Mul
            #                      - Reshape - Transpose
            #                      - Reshape - Reshape - Transpose - Transpose
            #                      - Gemm - Softmax - Gemm - Transpose - Reshape - MatMul - Add
            if node.op_type == "MatMul":
                if i + 19 >= node_count:
                    continue
                if self.node_reference[node.output[0]] != 1:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]
                node4 = self.mutable_graph_nodes[i + 3]
                node5 = self.mutable_graph_nodes[i + 4]
                node6 = self.mutable_graph_nodes[i + 5]
                node7 = self.mutable_graph_nodes[i + 6]
                node8 = self.mutable_graph_nodes[i + 7]
                node9 = self.mutable_graph_nodes[i + 8]
                node10 = self.mutable_graph_nodes[i + 9]
                node11 = self.mutable_graph_nodes[i + 10]
                node12 = self.mutable_graph_nodes[i + 11]
                node13 = self.mutable_graph_nodes[i + 12]
                node14 = self.mutable_graph_nodes[i + 13]
                node15 = self.mutable_graph_nodes[i + 14]
                node16 = self.mutable_graph_nodes[i + 15]
                node17 = self.mutable_graph_nodes[i + 16]
                node18 = self.mutable_graph_nodes[i + 17]
                node19 = self.mutable_graph_nodes[i + 18]
                node20 = self.mutable_graph_nodes[i + 19]

                if (
                    node2.op_type != "Add"
                    or node3.op_type != "MatMul"
                    or node4.op_type != "Add"
                    or node5.op_type != "MatMul"
                    or node6.op_type != "Add"
                    or node7.op_type != "Mul"
                    or node8.op_type != "Reshape"
                    or node9.op_type != "Transpose"
                    or node10.op_type != "Reshape"
                    or node11.op_type != "Reshape"
                    or node12.op_type != "Transpose"
                    or node13.op_type != "Transpose"
                    or node14.op_type != "MatMul"
                    or node15.op_type != "Softmax"
                    or node16.op_type != "MatMul"
                    or node17.op_type != "Transpose"
                    or node18.op_type != "Reshape"
                    or node19.op_type != "MatMul"
                    or node20.op_type != "Add"
                ):
                    continue
                if (
                    self.node_reference[node2.output[0]] != 1
                    or self.node_reference[node3.output[0]] != 1
                    or self.node_reference[node4.output[0]] != 1
                    or self.node_reference[node5.output[0]] != 1
                    or self.node_reference[node6.output[0]] != 1
                    or self.node_reference[node7.output[0]] != 1
                    or self.node_reference[node8.output[0]] != 1
                    or self.node_reference[node9.output[0]] != 1
                    or self.node_reference[node10.output[0]] != 1
                    or self.node_reference[node11.output[0]] != 1
                    or self.node_reference[node12.output[0]] != 1
                    or self.node_reference[node13.output[0]] != 1
                    or self.node_reference[node14.output[0]] != 1
                    or self.node_reference[node15.output[0]] != 1
                    or self.node_reference[node16.output[0]] != 1
                    or self.node_reference[node17.output[0]] != 1
                    or self.node_reference[node18.output[0]] != 1
                    or self.node_reference[node19.output[0]] != 1
                ):
                    continue
                if (
                    node2.input[0] != node.output[0]
                    or node4.input[0] != node3.output[0]
                    or node6.input[0] != node5.output[0]
                    or node7.input[0] != node2.output[0]
                    or node8.input[0] != node7.output[0]
                    or node9.input[0] != node8.output[0]
                    or node10.input[0] != node4.output[0]
                    or node11.input[0] != node6.output[0]
                    or node12.input[0] != node11.output[0]
                    or node13.input[0] != node10.output[0]
                    or node14.input[0] != node9.output[0]
                    or node14.input[1] != node13.output[0]
                    or node15.input[0] != node14.output[0]
                    or node16.input[0] != node15.output[0]
                    or node16.input[1] != node12.output[0]
                    or node17.input[0] != node16.output[0]
                    or node18.input[0] != node17.output[0]
                    or node19.input[0] != node18.output[0]
                    or node20.input[0] != node19.output[0]
                ):
                    continue

                q_B = self.get_node_attr_from_input_af(self.weights[node2.input[1]])
                k_B = self.get_node_attr_from_input_af(self.weights[node4.input[1]])
                v_B = self.get_node_attr_from_input_af(self.weights[node6.input[1]])
                o_B = self.get_node_attr_from_input_af(self.weights[node20.input[1]])

                if q_B.size != k_B.size or q_B.size != v_B.size or q_B.size != o_B.size:
                    continue

                embed_dim = q_B.size

                # 1 0 2
                perm9 = self.get_node_attr_ai(node9, "perm")
                perm12 = self.get_node_attr_ai(node12, "perm")
                if perm9.size != 3 or perm9[0] != 1 or perm9[1] != 0 or perm9[2] != 2:
                    continue
                if (
                    perm12.size != 3
                    or perm12[0] != 1
                    or perm12[1] != 0
                    or perm12[2] != 2
                ):
                    continue

                # 1 2 0
                perm13 = self.get_node_attr_ai(node13, "perm")
                if (
                    perm13.size != 3
                    or perm13[0] != 1
                    or perm13[1] != 2
                    or perm13[2] != 0
                ):
                    continue

                # 1 0 2
                perm17 = self.get_node_attr_ai(node17, "perm")
                if (
                    perm17.size != 3
                    or perm17[0] != 1
                    or perm17[1] != 0
                    or perm17[2] != 2
                ):
                    continue

                softmax_axis = self.get_node_attr_i(node15, "axis")
                if softmax_axis != 2:
                    continue

                # 1/-1 seqlen * num_heads, embed_dim / num_heads
                if len(node8.input) == 1:
                    shape8 = self.get_node_attr_ai(node8, "shape")
                else:
                    if node8.input[1] not in self.weights:
                        continue

                    shape8 = self.get_node_attr_from_input_ai(
                        self.weights[node8.input[1]]
                    )
                if len(node10.input) == 1:
                    shape10 = self.get_node_attr_ai(node10, "shape")
                else:
                    if node10.input[1] not in self.weights:
                        continue

                    shape10 = self.get_node_attr_from_input_ai(
                        self.weights[node10.input[1]]
                    )
                if len(node11.input) == 1:
                    shape11 = self.get_node_attr_ai(node11, "shape")
                else:
                    if node11.input[1] not in self.weights:
                        continue

                    shape11 = self.get_node_attr_from_input_ai(
                        self.weights[node11.input[1]]
                    )

                if shape8.size != 3 or shape10.size != 3 or shape11.size != 3:
                    continue
                if (
                    shape8[1] != shape10[1]
                    or shape8[1] != shape11[1]
                    or shape8[2] != shape10[2]
                    or shape8[2] != shape11[2]
                ):
                    continue

                num_heads = embed_dim / shape8[2]

                if len(node18.input) == 1:
                    shape18 = self.get_node_attr_ai(node18, "shape")
                else:
                    if node18.input[1] not in self.weights:
                        continue

                    shape18 = self.get_node_attr_from_input_ai(
                        self.weights[node18.input[1]]
                    )

                if (
                    shape18.size != 3
                    or shape18[2] != embed_dim
                    or shape18[1] * num_heads != shape8[1]
                ):
                    continue

                node.op_type = "noop_reducedncnn"
                node2.op_type = "noop_reducedncnn"
                node3.op_type = "noop_reducedncnn"
                node4.op_type = "noop_reducedncnn"
                node5.op_type = "noop_reducedncnn"
                node6.op_type = "noop_reducedncnn"
                node7.op_type = "noop_reducedncnn"
                node8.op_type = "noop_reducedncnn"
                node9.op_type = "noop_reducedncnn"
                node10.op_type = "noop_reducedncnn"
                node11.op_type = "noop_reducedncnn"
                node12.op_type = "noop_reducedncnn"
                node13.op_type = "noop_reducedncnn"
                node14.op_type = "noop_reducedncnn"
                node15.op_type = "noop_reducedncnn"
                node16.op_type = "noop_reducedncnn"
                node17.op_type = "noop_reducedncnn"
                node18.op_type = "noop_reducedncnn"
                node19.op_type = "noop_reducedncnn"

                self.node_reference[node2.input[0]] -= 1
                self.node_reference[node4.input[0]] -= 1
                self.node_reference[node6.input[0]] -= 1
                self.node_reference[node7.input[0]] -= 1
                self.node_reference[node7.input[1]] -= 1
                self.node_reference[node8.input[0]] -= 1

                if len(node8.input) == 2:
                    self.node_reference[node8.input[1]] -= 1
                self.node_reference[node9.input[0]] -= 1
                self.node_reference[node10.input[0]] -= 1
                if len(node10.input) == 2:
                    self.node_reference[node10.input[1]] -= 1
                self.node_reference[node11.input[0]] -= 1
                if len(node11.input) == 2:
                    self.node_reference[node11.input[1]] -= 1
                self.node_reference[node12.input[0]] -= 1
                self.node_reference[node13.input[0]] -= 1
                self.node_reference[node14.input[0]] -= 1
                self.node_reference[node14.input[1]] -= 1
                self.node_reference[node15.input[0]] -= 1
                self.node_reference[node16.input[0]] -= 1
                self.node_reference[node16.input[1]] -= 1
                self.node_reference[node17.input[0]] -= 1
                self.node_reference[node18.input[0]] -= 1
                if len(node18.input) == 2:
                    self.node_reference[node18.input[1]] -= 1
                self.node_reference[node19.input[0]] -= 1
                self.node_reference[node20.input[0]] -= 1

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)
                self.blob_names.pop(node3.output[0], None)
                self.blob_names.pop(node4.output[0], None)
                self.blob_names.pop(node5.output[0], None)
                self.blob_names.pop(node6.output[0], None)
                self.blob_names.pop(node7.output[0], None)
                self.blob_names.pop(node8.output[0], None)
                self.blob_names.pop(node9.output[0], None)
                self.blob_names.pop(node10.output[0], None)
                self.blob_names.pop(node11.output[0], None)
                self.blob_names.pop(node12.output[0], None)
                self.blob_names.pop(node13.output[0], None)
                self.blob_names.pop(node14.output[0], None)
                self.blob_names.pop(node15.output[0], None)
                self.blob_names.pop(node16.output[0], None)
                self.blob_names.pop(node17.output[0], None)
                self.blob_names.pop(node18.output[0], None)
                self.blob_names.pop(node19.output[0], None)

                qw = node.input[1]
                qb = node2.input[1]
                kw = node3.input[1]
                kb = node4.input[1]
                vw = node5.input[1]
                vb = node6.input[1]
                ow = node19.input[1]
                ob = node20.input[1]

                node20.op_type = "MultiHeadAttention"
                node20.ClearField("input")
                node20.input.append(node.input[0])
                node20.input.append(node3.input[0])
                node20.input.append(node5.input[0])
                node20.input.append(qw)
                node20.input.append(qb)
                node20.input.append(kw)
                node20.input.append(kb)
                node20.input.append(vw)
                node20.input.append(vb)
                node20.input.append(ow)
                node20.input.append(ob)

                attr_embed_dim = onnx.AttributeProto(
                    name="embed_dim", i=embed_dim, type=APT.INT
                )
                node20.attribute.append(attr_embed_dim)

                attr_num_heads = onnx.AttributeProto(
                    name="num_heads", i=num_heads, type=APT.INT
                )
                node20.attribute.append(attr_num_heads)

                reduced_node_count[0] += 19
                i += 19

        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # MultiHeadAttention <= MatMul(qkv) - Add - Split
            #                      - Mul
            #                      - Reshape - Transpose
            #                      - Reshape - Reshape - Transpose - Transpose
            #                      - Gemm - Softmax - Gemm - Transpose - Reshape - MatMul - Add
            if node.op_type == "MatMul":
                if i + 16 >= node_count:
                    continue
                if self.node_reference[node.output[0]] != 1:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]
                node4 = self.mutable_graph_nodes[i + 3]
                node5 = self.mutable_graph_nodes[i + 4]
                node6 = self.mutable_graph_nodes[i + 5]
                node7 = self.mutable_graph_nodes[i + 6]
                node8 = self.mutable_graph_nodes[i + 7]
                node9 = self.mutable_graph_nodes[i + 8]
                node10 = self.mutable_graph_nodes[i + 9]
                node11 = self.mutable_graph_nodes[i + 10]
                node12 = self.mutable_graph_nodes[i + 11]
                node13 = self.mutable_graph_nodes[i + 12]
                node14 = self.mutable_graph_nodes[i + 13]
                node15 = self.mutable_graph_nodes[i + 14]
                node16 = self.mutable_graph_nodes[i + 15]
                node17 = self.mutable_graph_nodes[i + 16]

                if (
                    node2.op_type != "Add"
                    or node3.op_type != "Split"
                    or node4.op_type != "Mul"
                    or node5.op_type != "Reshape"
                    or node6.op_type != "Transpose"
                    or node7.op_type != "Reshape"
                    or node8.op_type != "Reshape"
                    or node9.op_type != "Transpose"
                    or node10.op_type != "Transpose"
                    or node11.op_type != "MatMul"
                    or node12.op_type != "Softmax"
                    or node13.op_type != "MatMul"
                    or node14.op_type != "Transpose"
                    or node15.op_type != "Reshape"
                    or node16.op_type != "MatMul"
                    or node17.op_type != "Add"
                ):
                    continue
                if (
                    self.node_reference[node2.output[0]] != 1
                    or self.node_reference[node3.output[0]] != 1
                    or self.node_reference[node3.output[1]] != 1
                    or self.node_reference[node3.output[2]] != 1
                    or self.node_reference[node4.output[0]] != 1
                    or self.node_reference[node5.output[0]] != 1
                    or self.node_reference[node6.output[0]] != 1
                    or self.node_reference[node7.output[0]] != 1
                    or self.node_reference[node8.output[0]] != 1
                    or self.node_reference[node9.output[0]] != 1
                    or self.node_reference[node10.output[0]] != 1
                    or self.node_reference[node11.output[0]] != 1
                    or self.node_reference[node12.output[0]] != 1
                    or self.node_reference[node13.output[0]] != 1
                    or self.node_reference[node14.output[0]] != 1
                    or self.node_reference[node15.output[0]] != 1
                    or self.node_reference[node16.output[0]] != 1
                ):
                    continue
                if (
                    node2.input[0] != node.output[0]
                    or node3.input[0] != node2.output[0]
                    or node4.input[0] != node3.output[0]
                    or node5.input[0] != node4.output[0]
                    or node6.input[0] != node5.output[0]
                    or node7.input[0] != node3.output[1]
                    or node8.input[0] != node3.output[2]
                    or node9.input[0] != node8.output[0]
                    or node10.input[0] != node7.output[0]
                    or node11.input[0] != node6.output[0]
                    or node11.input[1] != node10.output[0]
                    or node12.input[0] != node11.output[0]
                    or node13.input[0] != node12.output[0]
                    or node13.input[1] != node9.output[0]
                    or node14.input[0] != node13.output[0]
                    or node15.input[0] != node14.output[0]
                    or node16.input[0] != node15.output[0]
                    or node17.input[0] != node16.output[0]
                ):
                    continue

                qkv_B = self.get_node_attr_from_input_af(self.weights[node2.input[1]])
                o_B = self.get_node_attr_from_input_af(self.weights[node17.input[1]])

                if qkv_B.size != o_B.size * 3:
                    continue

                embed_dim = o_B.size

                # 1 0 2
                perm6 = self.get_node_attr_ai(node6, "perm")
                perm9 = self.get_node_attr_ai(node9, "perm")
                if perm6.size != 3 or perm6[0] != 1 or perm6[1] != 0 or perm6[2] != 2:
                    continue
                if perm9.size != 3 or perm9[0] != 1 or perm9[1] != 0 or perm9[2] != 2:
                    continue

                # 1 2 0
                perm10 = self.get_node_attr_ai(node10, "perm")
                if (
                    perm10.size != 3
                    or perm10[0] != 1
                    or perm10[1] != 2
                    or perm10[2] != 0
                ):
                    continue

                # 1 0 2
                perm14 = self.get_node_attr_ai(node14, "perm")
                if (
                    perm14.size != 3
                    or perm14[0] != 1
                    or perm14[1] != 0
                    or perm14[2] != 2
                ):
                    continue

                softmax_axis = self.get_node_attr_i(node12, "axis")
                if softmax_axis != 2:
                    continue

                # 1/-1, seqlen * num_heads, embed_dim / num_heads
                if len(node5.input) == 1:
                    shape5 = self.get_node_attr_ai(node5, "shape")
                else:
                    if node5.input[1] not in self.weights:
                        continue

                    shape5 = self.get_node_attr_from_input_ai(
                        self.weights[node5.input[1]]
                    )
                if len(node7.input) == 1:
                    shape7 = self.get_node_attr_ai(node7, "shape")
                else:
                    if node7.input[1] not in self.weights:
                        continue

                    shape7 = self.get_node_attr_from_input_ai(
                        self.weights[node7.input[1]]
                    )
                if len(node8.input) == 1:
                    shape8 = self.get_node_attr_ai(node8, "shape")
                else:
                    if node8.input[1] not in self.weights:
                        continue

                    shape8 = self.get_node_attr_from_input_ai(
                        self.weights[node8.input[1]]
                    )

                if (
                    shape5[1] != shape7[1]
                    or shape5[1] != shape8[1]
                    or shape5[2] != shape7[2]
                    or shape5[2] != shape8[2]
                ):
                    continue

                num_heads = embed_dim / shape5[2]

                # 1, seqlen, embed_dim
                if len(node15.input) == 1:
                    shape15 = self.get_node_attr_ai(node15, "shape")
                else:
                    if node15.input[1] not in self.weights:
                        continue

                    shape15 = self.get_node_attr_from_input_ai(
                        self.weights[node15.input[1]]
                    )

                if (
                    shape15.size != 3
                    or shape15[2] != embed_dim
                    or shape15[1] * num_heads != shape8[1]
                ):
                    continue

                # reduce
                node.op_type = "noop_reducedncnn"
                node2.op_type = "noop_reducedncnn"
                node3.op_type = "noop_reducedncnn"
                node4.op_type = "noop_reducedncnn"
                node5.op_type = "noop_reducedncnn"
                node6.op_type = "noop_reducedncnn"
                node7.op_type = "noop_reducedncnn"
                node8.op_type = "noop_reducedncnn"
                node9.op_type = "noop_reducedncnn"
                node10.op_type = "noop_reducedncnn"
                node11.op_type = "noop_reducedncnn"
                node12.op_type = "noop_reducedncnn"
                node13.op_type = "noop_reducedncnn"
                node14.op_type = "noop_reducedncnn"
                node15.op_type = "noop_reducedncnn"
                node16.op_type = "noop_reducedncnn"

                self.node_reference[node2.input[0]] -= 1
                self.node_reference[node3.input[0]] -= 1
                self.node_reference[node4.input[0]] -= 1
                self.node_reference[node4.input[1]] -= 1
                self.node_reference[node5.input[0]] -= 1
                if len(node5.input) == 2:
                    self.node_reference[node5.input[1]] -= 1
                self.node_reference[node6.input[0]] -= 1
                self.node_reference[node7.input[0]] -= 1
                if len(node7.input) == 2:
                    self.node_reference[node7.input[1]] -= 1
                self.node_reference[node8.input[0]] -= 1
                if len(node8.input) == 2:
                    self.node_reference[node8.input[1]] -= 1
                self.node_reference[node9.input[0]] -= 1
                self.node_reference[node10.input[0]] -= 1
                self.node_reference[node11.input[0]] -= 1
                self.node_reference[node11.input[1]] -= 1
                self.node_reference[node12.input[0]] -= 1
                self.node_reference[node13.input[0]] -= 1
                self.node_reference[node13.input[1]] -= 1
                self.node_reference[node14.input[0]] -= 1
                self.node_reference[node15.input[0]] -= 1
                if len(node15.input) == 2:
                    self.node_reference[node15.input[1]] -= 1
                self.node_reference[node16.input[0]] -= 1
                self.node_reference[node17.input[0]] -= 1

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)
                self.blob_names.pop(node3.output[0], None)
                self.blob_names.pop(node3.output[1], None)
                self.blob_names.pop(node3.output[2], None)
                self.blob_names.pop(node4.output[0], None)
                self.blob_names.pop(node5.output[0], None)
                self.blob_names.pop(node6.output[0], None)
                self.blob_names.pop(node7.output[0], None)
                self.blob_names.pop(node8.output[0], None)
                self.blob_names.pop(node9.output[0], None)
                self.blob_names.pop(node10.output[0], None)
                self.blob_names.pop(node11.output[0], None)
                self.blob_names.pop(node12.output[0], None)
                self.blob_names.pop(node13.output[0], None)
                self.blob_names.pop(node14.output[0], None)
                self.blob_names.pop(node15.output[0], None)
                self.blob_names.pop(node16.output[0], None)

                qkvw = node.input[1]
                qkvb = node2.input[1]
                ow = node16.input[1]
                ob = node17.input[1]

                node17.op_type = "MultiHeadAttention"
                node17.ClearField("input")
                node17.input.append(node.input[0])
                node17.input.append(qkvw)
                node17.input.append(qkvb)
                node17.input.append(ow)
                node17.input.append(ob)

                attr_embed_dim = onnx.AttributeProto(
                    name="embed_dim", i=embed_dim, type=APT.INT
                )
                node17.attribute.append(attr_embed_dim)

                attr_num_heads = onnx.AttributeProto(
                    name="num_heads", i=num_heads, type=APT.INT
                )
                node17.attribute.append(attr_num_heads)

                reduced_node_count[0] += 16
                i += 16

    def fuse_binaryop_with_scalar(self) -> None:
        node_count = len(self.mutable_graph_nodes)
        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # Add/Sub/Mul/Div/Min/Max/Pow(a, x)
            if node.op_type in ["Add", "Sub", "Mul", "Div", "Min", "Max", "Pow"]:
                if node.input[0] not in self.weights:
                    continue

                scalar_b = self.weights[node.input[0]]
                if (
                    len(scalar_b.dims) != 0
                    or self.get_tensor_proto_data_size(scalar_b) != 1
                ):
                    continue

                if node.op_type == "Sub":
                    node.op_type = "RSub"
                elif node.op_type == "Div":
                    node.op_type = "RDiv"

                b = self.get_node_attr_from_input_f(scalar_b)

                self.node_reference[node.input[0]] -= 1

                inpt = node.input[1]
                node.ClearField("input")
                node.input.append(inpt)

                attr_with_scalar = onnx.AttributeProto(
                    name="with_scalar", i=1, type=APT.INT
                )
                node.attribute.append(attr_with_scalar)

                attr_b = onnx.AttributeProto(name="b", f=b, type=APT.FLOAT)
                node.attribute.append(attr_b)

        for i in range(node_count):
            node = self.mutable_graph_nodes[i]

            # Add/Sub/Mul/Div/Min/Max/Pow(x, b)
            if node.op_type in ["Add", "Sub", "Mul", "Div", "Min", "Max", "Pow"]:
                if node.input[1] not in self.weights:
                    continue

                scalar_b = self.weights[node.input[1]]
                if (
                    len(scalar_b.dims) != 0
                    or self.get_tensor_proto_data_size(scalar_b) != 1
                ):
                    continue

                b = self.get_node_attr_from_input_f(scalar_b)

                self.node_reference[node.input[1]] -= 1

                inpt = node.input[0]
                node.ClearField("input")
                node.input.append(inpt)

                attr_with_scalar = onnx.AttributeProto(
                    name="with_scalar", i=1, type=APT.INT
                )
                node.attribute.append(attr_with_scalar)

                attr_b = onnx.AttributeProto(name="b", f=b, type=APT.FLOAT)
                node.attribute.append(attr_b)

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
        print(self.node_count)
        print(len(self.blob_names))
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
        self.fuse_binaryop_with_scalar()
        self.fuse_rewrite_gather()

        # reduce common const weight node_reference
        for node in self.onnx_graph.node:
            op = node.op_type
            if op == "BatchNormalization":
                self.node_reference[node.input[1]] -= 1
                self.node_reference[node.input[2]] -= 1
                self.node_reference[node.input[3]] -= 1
                self.node_reference[node.input[4]] -= 1
            elif op == "Clip":
                if len(node.input) == 3:
                    self.node_reference[node.input[1]] -= 1
                    self.node_reference[node.input[2]] -= 1
            elif op == "Conv":
                self.node_reference[node.input[1]] -= 1
                if len(node.input) == 3:
                    self.node_reference[node.input[2]] -= 1
            elif op == "ConvTranspose":
                self.node_reference[node.input[1]] -= 1
                if len(node.input) == 3:
                    self.node_reference[node.input[2]] -= 1
            elif op == "EmbedLayerNormalization":
                self.node_reference[node.input[1]] -= 1
                self.node_reference[node.input[2]] -= 1
                self.node_reference[node.input[3]] -= 1
                self.node_reference[node.input[4]] -= 1
                self.node_reference[node.input[5]] -= 1
                self.node_reference[node.input[6]] -= 1
            elif op == "Gemm":
                alpha = self.get_node_attr_f(node, "alpha", 1)
                beta = self.get_node_attr_f(node, "beta", 1)
                transA = self.get_node_attr_i(node, "transA", 0)
                transB = self.get_node_attr_i(node, "transB", 0)

                if alpha == 1 and beta == 1 and transA == 0 and transB == 1:
                    # InnerProduct-like A * B + C
                    self.node_reference[node.input[1]] -= 1
                    self.node_reference[node.input[2]] -= 1
            elif op == "GroupNorm":
                affine = self.get_node_attr_i(node, "affine", 1)
                if affine:
                    self.node_reference[node.input[1]] -= 1
                    self.node_reference[node.input[2]] -= 1
            elif op == "GRU":
                for inpt in node.input:
                    self.node_reference[inpt] -= 1
            elif op == "InstanceNormalization":
                self.node_reference[node.input[1]] -= 1
                self.node_reference[node.input[2]] -= 1
            elif op == "LayerNorm":
                affine = self.get_node_attr_i(node, "affine", 1)
                if affine:
                    self.node_reference[node.input[1]] -= 1
                    self.node_reference[node.input[2]] -= 1
            elif op == "LSTM":
                for inpt in node.input:
                    self.node_reference[inpt] -= 1
            elif op == "MatMul":
                if (
                    node.input[1] in self.weights
                    and len(self.weights[node.input[1]].dims) == 2
                ):
                    # InnerProduct
                    self.node_reference[node.input[1]] -= 1
            elif op == "MultiHeadAttention":
                if len(node.input) == 5:
                    self.node_reference[node.input[1]] -= 1
                    self.node_reference[node.input[2]] -= 1
                    self.node_reference[node.input[3]] -= 1
                    self.node_reference[node.input[4]] -= 1
                else:
                    self.node_reference[node.input[3]] -= 1
                    self.node_reference[node.input[4]] -= 1
                    self.node_reference[node.input[5]] -= 1
                    self.node_reference[node.input[6]] -= 1
                    self.node_reference[node.input[7]] -= 1
                    self.node_reference[node.input[8]] -= 1
                    self.node_reference[node.input[9]] -= 1
                    self.node_reference[node.input[10]] -= 1
            elif op == "Pad":
                if len(node.input) >= 2:
                    self.node_reference[node.input[1]] -= 1
            elif op == "PRelu":
                self.node_reference[node.input[1]] -= 1
            elif op == "Reshape":
                if len(node.input) >= 2:
                    self.node_reference[node.input[1]] -= 1
            elif op == "Resize":
                if len(node.input) == 2:
                    # opset 10
                    self.node_reference[node.input[1]] -= 1
                else:
                    # opset 11+
                    self.node_reference[node.input[1]] -= 1
                    self.node_reference[node.input[2]] -= 1
                    if len(node.input) >= 4:
                        self.node_reference[node.input[3]] -= 1
            elif op == "RNN":
                for inpt in node.input:
                    self.node_reference[inpt] -= 1
            elif op == "Slice":
                if len(node.input) >= 2:
                    self.node_reference[node.input[1]] -= 1
                    self.node_reference[node.input[2]] -= 1
                    if len(node.input) >= 4:
                        self.node_reference[node.input[3]] -= 1
                    if len(node.input) >= 5:
                        self.node_reference[node.input[4]] -= 1
            elif op == "Upsample":
                if len(node.input) >= 2:
                    self.node_reference[node.input[1]] -= 1
            elif op == "adaptive_avg_pool2d" or op == "adaptive_max_pool2d":
                if len(node.input) >= 2:
                    self.node_reference[node.input[1]] -= 1

        # count all weight node with zero reference
        zero_reference_weight_node_count = 0
        for input_name, tp in self.weights.items():
            # there may be some weight nodes in initializer but none of the graph nodes use them
            # add them to blob_names so we could get proper blob count later
            self.blob_names[input_name] = None

            refcount = self.node_reference[input_name]
            if refcount == 0:
                zero_reference_weight_node_count += 1

        # we always treat constant nodes as weights or binaryop_weights
        # do not count it twice for layer_count
        constant_node_count_moved_to_weight = 0
        for node in self.onnx_graph.node:
            op = node.op_type
            if op == "Constant":
                constant_node_count_moved_to_weight += 1

        # some op may have anonymous input
        # LSTM sequence_lens
        self.blob_names.pop("", None)
        self.node_reference.pop("", None)

        # remove node_reference entries with references equal to one
        split_layer_count = 0
        splitncnn_blob_count = 0

        # split node reference
        split_node_reference = {}
        for ref, count in self.node_reference.items():
            if count > 1:
                split_layer_count += 1
                splitncnn_blob_count += count
                split_node_reference[ref] = count
        print(f"moved_to_weight: {constant_node_count_moved_to_weight}")
        print(f"num weights: {len(self.weights)}")
        print(f"zero ref: {zero_reference_weight_node_count}")
        print(f"reduced count: {reduced_node_count[0]}")
        print(f"input count: {input_node_count}")
        print(f"split layer: {split_layer_count}")
        print(f"num blobs: {len(self.blob_names)}")
        print(f"split blob: {splitncnn_blob_count}")
        ncnn_model = NcnnModel()
        ncnn_model.node_count = (
            self.node_count
            - constant_node_count_moved_to_weight
            + len(self.weights)
            - zero_reference_weight_node_count
            - reduced_node_count[0]
            + input_node_count
            + split_layer_count
        )
        ncnn_model.blob_count = (
            len(self.blob_names)
            - zero_reference_weight_node_count
            + splitncnn_blob_count
        )
        print(f"node count: {ncnn_model.node_count}")
        print(f"blob count: {ncnn_model.blob_count}")

        internal_split = 0
        for i, inpt in enumerate(self.onnx_graph.input):
            input_name = inpt.name

            # Make sure input is not in weights
            if input_name not in self.weights:
                ncnn_model.add_layer(NcnnLayer("Input", input_name, 0, 1, [input_name]))

                refcount = self.node_reference[input_name]
                if refcount <= 1:
                    continue

                layer_input_list = [
                    f"{input_name}_splitncnn_{j}" for j in range(refcount)
                ]
                ncnn_model.add_layer(
                    NcnnLayer(
                        "Split", f"splitncnn_input{i}", 1, refcount, layer_input_list
                    )
                )

        # This is where the memory data stuff goes, but we don't want it
        for i, input_name in enumerate(self.weights.keys()):
            if self.node_reference[input_name] > 1:
                internal_split += 1

        for node in self.onnx_graph.node:
            op = node.op_type

            if op == "noop_reducedncnn":
                continue

            name = node.name
            if not name:
                name = node.output[0]

            input_size = len(node.input)
            output_size = len(node.output)

            for input_name in node.input:
                # check weight
                if not input_name or input_name in self.weights:
                    input_size -= 1

            layer = NcnnLayer()
            if op in [
                "Abs",
                "Acos",
                "Asin",
                "Atan",
                "Ceil",
                "Cos",
                "Exp",
                "Floor",
                "Log",
                "Neg",
                "Reciprocal",
                "Sin",
                "Sqrt",
                "Tan",
                "Tanh",
            ]:
                layer.layer_type = "UnaryOp"
            elif op in ["Add", "Div", "Max", "Min", "Mul", "Pow" "RDiv", "RSub", "Sub"]:
                layer.layer_type = "BinaryOp"
            elif op == "AveragePool" or op == "MaxPool":
                kernel_shape = self.get_node_attr_ai(node, "kernel_shape")
                if kernel_shape.size == 1:
                    layer.layer_type = "Pooling1D"
                else:
                    layer.layer_type = "Pooling"
            elif op == "BatchNormalization":
                layer.layer_type = "BatchNorm"
            elif op == "BiasGelu":
                layer.layer_type = "BiasGelu"
            elif op == "Clip":
                layer.layer_type = "Clip"
            elif op == "Concat":
                layer.layer_type = "Concat"
            elif op == "Constant":
                continue
            elif op == "Conv":
                kernel_shape = self.get_node_attr_ai(node, "kernel_shape")
                if kernel_shape.size == 1:
                    layer.layer_type = "Convolution1D"
                else:
                    group = self.get_node_attr_i(node, "group", 1)
                    if group > 1:
                        layer.layer_type = "ConvolutionDepthWise"
                    else:
                        layer.layer_type = "Convolution"
            elif op == "ConvTranspose":
                group = self.get_node_attr_i(node, "group", 1)
                if group > 1:
                    layer.layer_type = "DeconvolutionDepthWise"
                else:
                    layer.layer_type = "Deconvolution"
            elif op == "Crop" or op == "Slice":
                layer.layer_type = "Crop"
            elif op == "DepthToSpace" or op == "PixelShuffle":
                layer.layer_type = "PixelShuffle"
            elif op == "Dropout":
                layer.layer_type = "Dropout"
                output_size = 1
            elif op == "Elu":
                layer.layer_type = "ELU"
            elif op == "EmbedLayerNormalization":
                layer.layer_type = "EmbedLayerNormalization"
            elif op == "Flatten":
                layer.layer_type = "Flatten"
            elif op == "Gelu":
                layer.layer_type = "GELU"
            elif op == "Gemm":
                alpha = self.get_node_attr_f(node, "alpha", 1)
                beta = self.get_node_attr_f(node, "beta", 1)
                transA = self.get_node_attr_i(node, "transA", 0)
                transB = self.get_node_attr_i(node, "transB", 0)

                if alpha == 1 and beta == 1 and transA == 0 and transB == 1:
                    # InnerProduct-like A * B + C
                    layer.layer_type = "InnerProduct"
                else:
                    layer.layer_type = "Gemm"
            elif op in [
                "GlobalAveragePool",
                "GlobalMaxPool",
                "adaptive_avg_pool2d",
                "adaptive_max_pool2d",
            ]:
                layer.layer_type = "Pooling"
            elif op == "GroupNorm":
                layer.layer_type = "GroupNorm"
            elif op == "GRU":
                layer.layer_type = "GRU"
            elif op == "HardSigmoid":
                layer.layer_type = "HardSigmoid"
            elif op == "HardSwish":
                layer.layer_type = "HardSwish"
            elif op == "ImageScaler":
                layer.layer_type = "Scale"
            elif op == "InstanceNormalization":
                layer.layer_type = "InstanceNorm"
            elif op == "LayerNorm":
                layer.layer_type = "LayerNorm"
            elif op == "LeakyRelu" or op == "Relu":
                layer.layer_type = "ReLU"
            elif op == "LRN":
                layer.layer_type = "LRN"
            elif op == "LSTM":
                layer.layer_type = "LSTM"
            elif op == "MatMul":
                if node.input[1] in self.weights:
                    layer.layer_type = "InnerProduct"
                else:
                    layer.layer_type = "Gemm"
            elif op == "MultiHeadAttention":
                layer.layer_type = "MultiHeadAttention"
            elif op == "Normalize":
                layer.layer_type = "Normalize"
            elif op == "Pad":
                layer.layer_type = "Padding"
            elif op == "PRelu":
                layer.layer_type = "PReLU"
            elif op in [
                "ReduceMax",
                "ReduceMin",
                "ReduceMean",
                "ReduceProd",
                "ReduceSum",
                "ReduceSumSquare",
                "ReduceL1",
                "ReduceL2",
                "ReduceLogSum",
                "ReduceLogSumExp",
            ]:
                layer.layer_type = "Reduction"
            elif op == "Reorg":
                layer.layer_type = "Reorg"
            elif op == "Reshape":
                layer.layer_type = "Reshape"
            elif op == "RNN":
                layer.layer_type = "RNN"
            elif op == "ShuffleChannel":
                layer.layer_type == "ShuffleChannel"
            elif op == "Sigmoid":
                layer.layer_type == "Sigmoid"
            elif op == "SkipLayerNormalization":
                layer.layer_type == "SkipLayerNormalization"
            elif op == "Softmax":
                layer.layer_type = "Softmax"
            elif op == "Softplus":
                layer.layer_type = "Softplus"
            elif op == "Split":
                layer.layer_type = "Slice"
            elif op == "Squeeze":
                layer.layer_type = "Squeeze"
            elif op == "Sum":
                layer.layer_type = "Eltwise"
            elif op == "Swish":
                layer.layer_type = "Swish"
            elif op == "Transpose":
                layer.layer_type = "Permute"
            elif op == "Upsample" or op == "Resize":
                layer.layer_type = "Interp"
            elif op == "Unsqueeze":
                layer.layer_type = "ExpandDims"
            else:
                raise TypeError(f"{op} not currently supported by NCNN.")

            layer.layer_name = name
            layer.num_inputs = input_size
            layer.num_outputs = output_size

            for input_name in node.input:
                # check weight
                if not input_name or (
                    input_name in self.weights and self.node_reference[input_name] == 0
                ):
                    continue

                if input_name in split_node_reference:
                    refidx = split_node_reference[input_name] - 1
                    split_node_reference[input_name] = refidx
                    input_name = f"{input_name}_splitncnn_{refidx}"

                layer.inputs.append(input_name)

            for output_name in node.output:
                layer.outputs.append(output_name)

            if op == "Abs":
                layer.params[0] = UOT.ABS
            elif op == "Acos":
                layer.params[0] = UOT.ACOS
            elif op == "Add":
                layer.params[0] = BOT.ADD

                with_scalar = self.get_node_attr_i(node, "with_scalar", 0)
                b = self.get_node_attr_f(node, "b", 0)
                if with_scalar:
                    layer.params[1] = with_scalar
                    layer.params[2] = b
            elif op == "Asin":
                layer.params[0] = UOT.ASIN
            elif op == "Atan":
                layer.params[0] = UOT.ATAN
            elif op == "AveragePool" or op == "MaxPool":
                auto_pad = self.get_node_attr_s(node, "auto_pad")
                ceil_mode = self.get_node_attr_i(node, "ceil_mode", 0)
                kernel_shape = self.get_node_attr_ai(node, "kernel_shape")
                strides = self.get_node_attr_ai(node, "strides")
                pads = self.get_node_attr_ai(node, "pads")

                pool = int(op == "AveragePool")

                if ceil_mode == 1:
                    pad_mode = 0
                elif auto_pad == "SAME_UPPER":
                    pad_mode = 2
                elif auto_pad == "SAME_LOWER":
                    pad_mode = 3
                else:
                    pad_mode = 1

                layer.params[0] = pool

                if kernel_shape.size == 1:
                    layer.params[1] = kernel_shape[0]
                elif kernel_shape.size == 2:
                    layer.params[1] = kernel_shape[1]
                    layer.params[11] = kernel_shape[0]

                if strides.size == 1:
                    layer.params[2] = strides[0]
                elif strides.size == 2:
                    layer.params[2] = strides[1]
                    layer.params[12] = strides[0]

                if pads.size == 1:
                    layer.params[3] = pads[0]
                elif pads.size == 2 or pads.size == 4:
                    layer.params[3] = pads[1]
                    layer.params[13] = pads[0]
                elif pads.size == 4:
                    layer.params[3] = pads[1]
                    layer.params[13] = pads[0]
                    layer.params[14] = pads[3]
                    layer.params[15] = pads[2]

                layer.params[5] = pad_mode

                if op == "AveragePool":
                    avgpool_count_include_pad = self.get_node_attr_i(
                        node, "count_include_pad", 0
                    )
                    layer.params[6] = avgpool_count_include_pad
                # TODO: add in skipped ops
            elif op == "Concat":
                axis = self.get_node_attr_i(node, "axis", 1)
                layer.params[0] = axis - 1 if axis > 0 else axis
            elif op == "Constant":
                logger.error("Code should not have reached here.")
            elif op == "Conv":
                W = self.weights[node.input[1]]

                num_filter = W.dims[0]
                has_bias = int(len(node.input) == 3)

                auto_pad = self.get_node_attr_s(node, "auto_pad")
                kernel_shape = self.get_node_attr_ai(node, "kernel_shape")
                dilations = self.get_node_attr_ai(node, "dilations")
                strides = self.get_node_attr_ai(node, "strides")
                pads = self.get_node_attr_ai(node, "pads")
                group = self.get_node_attr_i(node, "group", 1)

                layer.params[0] = num_filter

                if kernel_shape.size == 1:
                    layer.params[1] = kernel_shape[0]
                elif kernel_shape.size == 2:
                    layer.params[1] = kernel_shape[1]
                    layer.params[11] = kernel_shape[0]

                if dilations.size == 1:
                    layer.params[2] = dilations[0]
                elif dilations.size == 2:
                    layer.params[2] = dilations[1]
                    layer.params[12] = dilations[0]

                if strides.size == 1:
                    layer.params[3] = strides[0]
                elif strides.size == 2:
                    layer.params[3] = strides[1]
                    layer.params[13] = strides[0]

                if auto_pad == "SAME_UPPER":
                    layer.params[4] = -233
                elif auto_pad == "SAME_LOWER":
                    layer.params[4] = -234
                else:
                    if pads.size == 1:
                        layer.params[4] = pads[0]
                    elif pads.size == 2:
                        layer.params[4] = pads[1]
                        layer.params[14] = pads[0]
                    elif pads.size == 4:
                        layer.params[4] = pads[1]
                        layer.params[14] = pads[0]
                        layer.params[15] = pads[3]
                        layer.params[16] = pads[2]

                layer.params[5] = has_bias

                layer.params[6] = self.get_tensor_proto_data_size(W)

                if group > 1:
                    layer.params[7] = group

                layer.quantize_tag = b"\x00\x00\x00\x00"
                layer.weight_data = self.write_tensor_proto_data(W, layer)

                if has_bias:
                    B = self.weights[node.input[2]]
                    self.write_tensor_proto_data(B, layer)
            elif op == "LeakyRelu":
                alpha = self.get_node_attr_f(node, "alpha", 0.01)
                layer.params[0] = alpha
            elif op == "Mul":
                layer.params[0] = BOT.MUL

                with_scalar = self.get_node_attr_i(node, "with_scalar", 0)
                b = self.get_node_attr_f(node, "b", 0)
                if with_scalar:
                    layer.params[1] = with_scalar
                    layer.params[2] = b
            elif op == "Resize":
                mode = self.get_node_attr_s(node, "mode")
                align = self.get_node_attr_s(node, "coordinate_transformation_mode")

                if len(node.input) == 2:
                    # opset 10
                    scales = self.get_node_attr_from_input_af(
                        self.weights[node.input[1]]
                    )
                    sizes = np.empty(0, np.int32)
                else:
                    # opset 11+
                    scales = self.get_node_attr_from_input_af(
                        self.weights[node.input[2]]
                    )
                    if len(node.input) >= 4:
                        sizes = self.get_node_attr_from_input_ai(
                            self.weights[node.input[3]]
                        )
                    else:
                        sizes = np.empty(0, np.int32)

                if mode == "linear":
                    resize_type = 2
                elif mode == "cubic":
                    resize_type = 3
                else:
                    resize_type = 1

                if scales.size == 0 and sizes.size == 0:
                    raise TypeError(
                        "Unsupported Resize scales and sizes are all empty."
                    )

                if scales.size == 2:
                    w_scale = scales[1]
                elif scales.size == 3:
                    h_scale = scales[1]
                    w_scale = scales[2]
                elif scales.size == 4:
                    if scales[1] != 1:
                        raise TypeError("Unsupported Resize scales.")
                    h_scale = scales[2]
                    w_scale = scales[3]
                else:
                    h_scale = 1
                    w_scale = 1

                if sizes.size == 2:
                    output_width = sizes[1]
                elif sizes.size == 3:
                    output_height = sizes[1]
                    output_width = sizes[2]
                elif sizes.size == 4:
                    output_height = sizes[2]
                    output_width = sizes[3]
                else:
                    output_height = 0
                    output_width = 0

                align_corner = int(align == "align_corners")

                layer.params[0] = resize_type
                layer.params[1] = h_scale
                layer.params[2] = w_scale
                layer.params[3] = output_height
                layer.params[4] = output_width
                layer.params[6] = align_corner

            ncnn_model.add_layer(layer)

            for output_name in node.output:
                if output_name in self.node_reference:
                    refcount = self.node_reference[output_name]
                    if refcount > 1:
                        ncnn_model.add_layer(
                            NcnnLayer(
                                "Split",
                                f"splitncnn_{internal_split}",
                                1,
                                refcount,
                                outputs=[
                                    output_name,
                                    *[
                                        f"{output_name}_splitncnn_{j}"
                                        for j in range(refcount)
                                    ],
                                ],
                            )
                        )

                        internal_split += 1

        return ncnn_model


if __name__ == "__main__":
    model = onnx.load_model("D:/Upscaling/models/LoD/New folder/4x_BSRGAN.onnx")
    converter = Onnx2NcnnConverter(model)
    model = converter.convert()
    model.write_param("D:/Upscaling/ncnn_output.param")
    model.write_bin("D:/Upscaling/ncnn_output.bin")
