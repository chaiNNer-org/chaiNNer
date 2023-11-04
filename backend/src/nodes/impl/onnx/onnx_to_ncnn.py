# ruff: noqa: N806
from __future__ import annotations

import numpy as np
import onnx.numpy_helper as onph
from google.protobuf.internal.containers import (
    RepeatedCompositeFieldContainer,
    RepeatedScalarFieldContainer,
)
from onnx.onnx_pb import AttributeProto, GraphProto, ModelProto, NodeProto, TensorProto
from sanic.log import logger

from ..ncnn.model import (
    DTYPE_FP16,
    DTYPE_FP32,
    BinaryOpTypes,
    EltwiseOpTypes,
    GruDirectionFlags,
    InterpResizeTypes,
    NcnnLayer,
    NcnnModel,
    NormalizeEpsModes,
    PaddingTypes,
    PadModes,
    PermuteOrderTypes,
    ReductionOpTypes,
    UnaryOpTypes,
)
from ..ncnn.optimizer import NcnnOptimizer
from .tensorproto_utils import (
    APT,
    FLOAT32_MAX,
    get_node_attr_af,
    get_node_attr_ai,
    get_node_attr_f,
    get_node_attr_from_input_af,
    get_node_attr_from_input_ai,
    get_node_attr_from_input_f,
    get_node_attr_i,
    get_node_attr_s,
    get_node_attr_tensor,
    get_tensor_proto_data_size,
    set_node_attr_ai,
)

UOT = UnaryOpTypes
BOT = BinaryOpTypes
EOT = EltwiseOpTypes
GRU = GruDirectionFlags
IRT = InterpResizeTypes
NEM = NormalizeEpsModes
PAM = PadModes
PAT = PaddingTypes
POT = PermuteOrderTypes
ROT = ReductionOpTypes


class Onnx2NcnnConverter:
    def __init__(self, onnx_model: ModelProto):
        self.onnx_graph: GraphProto = onnx_model.graph
        self.mutable_graph_nodes: list[NodeProto] = list(self.onnx_graph.node)
        self.node_count: int = len(self.onnx_graph.node)
        self.weights: dict[str, TensorProto] = {
            initializer.name: initializer for initializer in self.onnx_graph.initializer
        }

        self.producers: dict[str, None] = {i.name: None for i in self.onnx_graph.input}
        self.node_reference: dict[str, int] = {}
        self.blob_names: dict[str, None] = {}

    @staticmethod
    def add_weight(
        layer: NcnnLayer,
        weight_name: str,
        data: float | (int | (np.ndarray | TensorProto)),
        quantize_tag: bytes = b"",
    ) -> int:
        if isinstance(data, TensorProto):
            data = onph.to_array(data)

        return layer.add_weight(weight_name, data, quantize_tag)

    @staticmethod
    def clear_container(
        container: RepeatedCompositeFieldContainer | RepeatedScalarFieldContainer,
    ) -> None:
        for _ in range(len(container)):
            container.pop()

    def swap_nodes(self, a: int, b: int) -> None:
        self.mutable_graph_nodes[a], self.mutable_graph_nodes[b] = (
            self.mutable_graph_nodes[b],
            self.mutable_graph_nodes[a],
        )

    def fuse_rewrite_gather(self) -> None:
        for gather in self.mutable_graph_nodes:
            if gather.op_type == "Gather":
                indices = get_node_attr_from_input_ai(self.weights[gather.input[1]])
                if len(indices) == 1:
                    # Reconstruct node connections
                    self.node_reference[gather.input[1]] -= 1
                    origin_inp = gather.input[0]
                    gather.ClearField("input")
                    gather.input.append(origin_inp)

                    # Update axis, starts and ends
                    axis = get_node_attr_i(gather, "axis", 1)
                    gather.op_type = "Crop"
                    gather.ClearField("attribute")

                    index = indices[0]
                    set_node_attr_ai(gather, "starts", np.array([index], np.int32))
                    set_node_attr_ai(gather, "ends", np.array([index + 1], np.int32))
                    set_node_attr_ai(gather, "axis", np.array([axis], np.int32))

    def fuse_weight_reshape(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]
            if node.op_type == "Reshape":
                if node.input[0] in self.weights:
                    self.weights[node.output[0]] = self.weights[node.input[0]]
                    if len(node.input) == 1:
                        shape = get_node_attr_ai(node, "shape")
                    elif len(node.input) == 2:
                        shape = get_node_attr_from_input_ai(self.weights[node.input[1]])
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
                    i += 1  # noqa

    def fuse_weight_transpose(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]
            if node.op_type == "Transpose":
                if (
                    node.input[0] in self.weights
                    and len(self.weights[node.input[0]].dims) == 2
                ):
                    perm = get_node_attr_ai(node, "perm")
                    if perm.size != 2 or perm[0] != 1 or perm[1] != 0:
                        continue

                    self.weights[node.output[0]] = self.weights[node.input[0]]

                    # Permute weight
                    B = self.weights[node.output[0]]

                    h, w = B.dims[:2]

                    permuted_data = onph.to_array(B).T

                    B.dims[:2] = (w, h)

                    if B.raw_data:
                        B.raw_data = permuted_data.tobytes()
                    else:
                        self.clear_container(B.float_data)
                        B.float_data.extend(permuted_data)

                    # Reduce
                    node.op_type = "noop_reducednccn"
                    self.node_reference[node.input[0]] -= 1

                    reduced_node_count[0] += 1
                    i += 1  # noqa

    def fuse_shufflechannel(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # ShuffleChannel <= Reshape - Transpose - Reshape
            # ShuffleChannel <= Reshape - Transpose - Constant - Reshape
            if node.op_type == "Reshape":
                if self.node_reference[node.output[0]] != 1:
                    continue

                if len(node.input) == 1:
                    shape = get_node_attr_ai(node, "shape")
                else:
                    # Skip weight reshape
                    if node.input[1] not in self.weights:
                        continue
                    shape = get_node_attr_from_input_ai(self.weights[node.input[1]])

                # 1 groups channels_per_group, height, width
                # reverse style = channels_per_group, groups, height * width
                if (shape.size not in (5, 3)) or (shape.size == 5 and shape[0] != 1):
                    continue
                if i + 2 >= self.node_count:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]

                if node3.op_type == "Constant":
                    if i + 3 >= self.node_count:
                        continue
                    node3 = self.mutable_graph_nodes[i + 3]
                if (node2.op_type != "Transpose" or node3.op_type != "Reshape") or (
                    self.node_reference[node2.output[0]] != 1
                ):
                    continue

                # 0 2 1 3 4
                # reverse style = 1 0 2
                perm = get_node_attr_ai(node2, "perm")
                if perm.size not in (5, 3):
                    continue
                if perm.size == 5 and (
                    perm[0] != 0
                    or perm[1] != 2
                    or perm[2] != 1
                    or perm[3] != 3
                    or perm[4] != 4
                ):
                    continue
                if perm.size == 3 and (perm[0] != 1 or perm[1] != 0 or perm[2] != 2):
                    continue

                if len(node3.input) == 1:
                    shape3 = get_node_attr_ai(node3, "shape")
                else:
                    if node3.input[1] not in self.weights:
                        continue
                    shape3 = get_node_attr_from_input_ai(self.weights[node3.input[1]])

                # 1, -1, height, width
                # reverse style = group, -1, channels_per_group, height, width
                if shape3.size not in (4, 5):
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

                attr_group = AttributeProto(name="group", i=shape[1], type=APT.INT)
                node3.attribute.append(attr_group)

                attr_reverse = AttributeProto(
                    name="reverse", i=int(shape.size == 3), type=APT.INT
                )
                node3.attribute.append(attr_reverse)

                reduced_node_count[0] += 2
                i += 2  # noqa

    def fuse_shufflechannel_split(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # Split <= ShuffleChannel(reverse type) - Gather(0) - Gather(1)
            if node.op_type == "ShuffleChannel":
                # reverse = 1
                reverse = get_node_attr_i(node, "reverse")
                if reverse != 1 or (i + 2 >= self.node_count):
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]

                if node2.op_type != "Gather" or node3.op_type != "Gather":
                    continue
                if node2.input[0] != node.output[0] or node3.input[0] != node.output[0]:
                    continue

                # axis = 0 or indices = 0
                gather2_axis = get_node_attr_i(node2, "axis")
                if gather2_axis != 0 or node2.input[1] not in self.weights:
                    continue

                gather2_indices = get_node_attr_from_input_ai(
                    self.weights[node2.input[1]]
                )
                if gather2_indices.size != 1 or gather2_indices[0] != 0:
                    continue

                # axis = 0 or indices = 1
                gather3_axis = get_node_attr_i(node3, "axis")
                if gather3_axis != 0 or node3.input[1] not in self.weights:
                    continue

                gather3_indices = get_node_attr_from_input_ai(
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
                attr_axis = AttributeProto(name="axis", i=1, type=APT.INT)
                node3.attribute.append(attr_axis)

                reduced_node_count[0] += 1
                i += 1  # noqa

    def fuse_hardswish(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # HardSwish <= Add(+3) - Clip(0, 6) - Mul(X, ) - Div( / 6)
            # HardSwish <= Add(+3) - Clip(0, 6) - Mul(X, ) - Mul(*(1 / 6))
            # HardSwish <= Add(+3) - Clip(0, 6) - Mul(X, ) - Constant - Div( / 6)
            # HardSwish <= Add(+3) - Clip(0, 6) - Mul(X, ) - Constant - Mul(*(1 / 6))
            # out = x * F.relu6(x + 3, inplace=True) / 6
            if node.op_type == "Add":
                if (
                    self.node_reference[node.output[0]] != 1
                    or i + 3 >= self.node_count
                    or node.input[1] not in self.weights
                ):
                    continue

                add_three = self.weights[node.input[1]]
                if (
                    len(add_three.dims) != 0
                    or get_tensor_proto_data_size(add_three, add_three.data_type) != 1
                ):
                    continue

                constant_add_three = get_node_attr_from_input_f(add_three)
                if constant_add_three != 3:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]
                node4 = self.mutable_graph_nodes[i + 3]

                if node4.op_type == "Constant":
                    if i + 4 >= self.node_count:
                        continue
                    node4 = self.mutable_graph_nodes[i + 4]
                if (
                    node2.op_type != "Clip"
                    or node3.op_type != "Mul"
                    or (node4.op_type not in ("Div", "Mul"))
                ):
                    continue
                if self.node_reference[node2.output[0]] != 1:
                    continue

                if len(node2.input) == 1:
                    relu6_min = get_node_attr_f(node2, "min", -FLOAT32_MAX)
                    relu6_max = get_node_attr_f(node2, "max", FLOAT32_MAX)
                else:
                    min_tp = self.weights[node2.input[1]]
                    max_tp = self.weights[node2.input[2]]
                    relu6_min = get_node_attr_from_input_f(min_tp)
                    relu6_max = get_node_attr_from_input_f(max_tp)

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
                    or get_tensor_proto_data_size(div_six, div_six.data_type) != 1
                ):
                    continue

                constant_div_six = get_node_attr_from_input_f(div_six)
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

                attr_alpha = AttributeProto(name="alpha", f=1 / 6, type=APT.FLOAT)
                node4.attribute.append(attr_alpha)

                attr_beta = AttributeProto(name="beta", f=0.5, type=APT.FLOAT)
                node4.attribute.append(attr_beta)

                reduced_node_count[0] += 3
                i += 3  # noqa

        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # HardSwish <= HardSigmoid - Mul
            # out = x * hsigmoid(x)
            if node.op_type == "HardSigmoid":
                if self.node_reference[node.output[0]] != 1:
                    continue

                alpha = get_node_attr_f(node, "alpha", 0.2)
                beta = get_node_attr_f(node, "beta", 0.5)

                if i + 1 >= self.node_count:
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

                attr_alpha = AttributeProto(name="alpha", f=alpha, type=APT.FLOAT)
                node2.attribute.append(attr_alpha)

                attr_beta = AttributeProto(name="beta", f=beta, type=APT.FLOAT)
                node2.attribute.append(attr_beta)

                reduced_node_count[0] += 1
                i += 1  # noqa

    def fuse_hardsigmoid(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # HardSigmoid <= Add(+3) - Clip(0, 6) - Div( / 6)
            # HardSigmoid <= Add(+3) - Clip(0, 6) - Mul(*(1 / 6))
            # HardSigmoid <= Add(+3) - Clip(0, 6) - Constant - Div( / 6)
            # HardSigmoid <= Add(+3) - Clip(0, 6) - Constant - Mul(*(1 / 6))
            # out = F.relu6(x + 3, inplace=True) / 6
            if node.op_type == "Add":
                if (
                    self.node_reference[node.output[0]] != 1
                    or i + 2 >= self.node_count
                    or node.input[1] not in self.weights
                ):
                    continue

                add_three = self.weights[node.input[1]]
                if (
                    len(add_three.dims) != 0
                    or get_tensor_proto_data_size(add_three, add_three.data_type) != 1
                ):
                    continue

                constant_add_three = self.weights[node.input[1]]
                if constant_add_three != 3:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]

                if node3.op_type == "Constant":
                    if i + 3 >= self.node_count:
                        continue
                    node3 = self.mutable_graph_nodes[i + 3]

                if node2.op_type != "Clip" or (node3.op_type not in ("Div", "Mul")):
                    continue

                if self.node_reference[node2.output[0]] != 1:
                    continue

                if len(node2.input) == 1:
                    relu6_min = get_node_attr_f(node2, "min", -FLOAT32_MAX)
                    relu6_max = get_node_attr_f(node2, "max", FLOAT32_MAX)
                else:
                    min_tp = self.weights[node2.input[1]]
                    max_tp = self.weights[node2.input[2]]
                    relu6_min = get_node_attr_from_input_f(min_tp)
                    relu6_max = get_node_attr_from_input_f(max_tp)

                if relu6_min != 0 or relu6_max != 6:
                    continue
                if node3.input[1] not in self.weights:
                    continue

                div_six = self.weights[node3.input[1]]
                if (
                    len(div_six.dims) != 0
                    or get_tensor_proto_data_size(div_six, div_six.data_type) != 1
                ):
                    continue

                constant_div_six = get_node_attr_from_input_f(div_six)
                if (node3.op_type == "Div" and constant_div_six != 6) or (
                    node3.op_type == "Mul" and constant_div_six != 1 / 6
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

                attr_alpha = AttributeProto(name="alpha", f=1 / 6, type=APT.FLOAT)
                node3.attribute.append(attr_alpha)

                attr_beta = AttributeProto(name="beta", f=0.5, type=APT.FLOAT)
                node3.attribute.append(attr_beta)

                reduced_node_count[0] += 2
                i += 2  # noqa

    def fuse_swish(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # Swish <= Sigmoid - Mul
            # x * torch.sigmoid(x)
            if node.op_type == "Sigmoid":
                if self.node_reference[node.output[0]] != 1 or i + 1 >= self.node_count:
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

                node2.op_type = "Swish"
                node2.ClearField("input")
                node2.input.append(node.input[0])

                reduced_node_count[0] += 1
                i += 1  # noqa

    def fuse_batchnorm1d_squeeze_unsqueeze(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # BatchNormalization <= Unsqueeze - BatchNormalization - Squeeze
            if node.op_type == "Unsqueeze":
                if self.node_reference[node.output[0]] != 1 or i + 2 >= self.node_count:
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
                i += 2  # noqa

    def fuse_unsqueeze_prelu(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
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
                axes = get_node_attr_ai(node, "axes")
                if axes.size != 2 or axes[0] != 1 or axes[1] != 2:
                    continue
                if i + 1 >= self.node_count:
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
                i += 1  # noqa

    def fuse_normalize(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # Normalize <= X - ReduceL2 - Clip - Expand - Div
            # Normalize <= X - ReduceL2 - Clip - Shape - Expand - Div
            if node.op_type == "ReduceL2":
                if self.node_reference[node.output[0]] != 1:
                    continue

                # axes = (1)
                axes = get_node_attr_ai(node, "axes")
                if len(axes) != 1 or axes[0] != 1 or i + 3 >= self.node_count:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]
                node4 = self.mutable_graph_nodes[i + 3]

                has_shape_node = node3.op_type == "Shape"
                node_shape = NodeProto()
                if has_shape_node:
                    if i + 4 >= self.node_count:
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
                    clip_min = get_node_attr_f(node2, "min", -FLOAT32_MAX)
                else:
                    min_tp = self.weights[node2.input[1]]
                    clip_min = get_node_attr_from_input_f(min_tp)

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

                attr_alpha = AttributeProto(name="eps", f=clip_min, type=APT.FLOAT)
                node4.attribute.append(attr_alpha)

                reduced_node_count[0] += 4 if has_shape_node else 3
                i += 4 if has_shape_node else 3  # noqa

    def fuse_groupnorm(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # GroupNorm <= X - Reshape - InstanceNormalization - Reshape - Mul - Add
            if node.op_type == "Reshape":
                if self.node_reference[node.output[0]] != 1:
                    continue

                if len(node.input) == 1:
                    shape = get_node_attr_ai(node, "shape")
                else:
                    # Skip weight reshape
                    if node.input[1] not in self.weights:
                        continue

                    shape = get_node_attr_from_input_ai(self.weights[node.input[1]])

                # 0, group, -1
                if (
                    shape.size != 3
                    or shape[0] != 0
                    or shape[2] != -1
                    or i + 4 >= self.node_count
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

                # InstanceNormalization S=1 B=0
                S = get_node_attr_from_input_af(self.weights[node2.input[1]])
                B = get_node_attr_from_input_af(self.weights[node2.input[2]])
                if S.size != groups or B.size != groups:
                    continue
                if np.any(S != 1) or np.any(B != 0):
                    continue

                if len(node3.input) == 1:
                    shape2 = get_node_attr_ai(node3, "shape")
                else:
                    # Skip weight reshape
                    if node3.input[1] not in self.weights:
                        continue

                    shape2 = get_node_attr_from_input_ai(self.weights[node3.input[1]])

                # 1, channels, w, h
                if shape2.size != 4 or shape2[0] != 1:
                    continue

                channels = shape2[1]

                # affine
                affine_S = get_node_attr_from_input_af(self.weights[node4.input[1]])
                affine_B = get_node_attr_from_input_af(self.weights[node5.input[1]])
                if channels not in (affine_S.size, affine_B.size):
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

                attr_groups = AttributeProto(name="groups", i=groups, type=APT.INT)
                node5.attribute.append(attr_groups)

                attr_channels = AttributeProto(
                    name="channels", i=channels, type=APT.INT
                )
                node5.attribute.append(attr_channels)

                # +eps
                eps = get_node_attr_f(node2, "epsilon", 0.00001)
                attr_eps = AttributeProto(name="epsilon", f=eps, type=APT.FLOAT)
                node5.attribute.append(attr_eps)

                attr_affine = AttributeProto(name="affine", i=1, type=APT.INT)
                node5.attribute.append(attr_affine)

                reduced_node_count[0] += 4
                i += 4  # noqa

    def fuse_layernorm(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # LayerNorm <= X - ReduceMean - Sub - Pow - ReduceMean - Add - Sqrt - Div
            # LayerNorm <= X - ReduceMean - Sub - Pow - ReduceMean - Add - Sqrt - Div - Mul - Add
            if node.op_type == "ReduceMean":
                if self.node_reference[node.output[0]] != 1:
                    continue

                axes = get_node_attr_ai(node, "axes")

                # -1
                # -2 -1
                if axes.size not in (1, 2):
                    continue
                if (axes.size == 1 and axes[0] != -1) or (
                    axes.size == 2 and (axes[0] != -2 or axes[1] != -1)
                ):
                    continue
                if i + 6 >= self.node_count:
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
                    or get_tensor_proto_data_size(pow_two, pow_two.data_type) != 1
                ):
                    continue

                constant_pow_two = get_node_attr_from_input_f(pow_two)
                if constant_pow_two != 2:
                    continue

                axes4 = get_node_attr_ai(node4, "axes")

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
                    or get_tensor_proto_data_size(add_eps, add_eps.data_type) != 1
                ):
                    continue

                eps = get_node_attr_from_input_f(add_eps)

                affine = 0
                while i + 8 < self.node_count:
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
                    affine_S = get_node_attr_from_input_af(self.weights[node8.input[1]])
                    affine_B = get_node_attr_from_input_af(self.weights[node9.input[1]])
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

                attr_eps = AttributeProto(name="epsilon", f=eps, type=APT.FLOAT)
                attr_affine = AttributeProto(name="affine", i=affine, type=APT.INT)
                if affine == 0:
                    node7.op_type = "LayerNorm"
                    node7.ClearField("input")
                    node7.input.append(node.input[0])

                    node7.attribute.append(attr_eps)
                    node7.attribute.append(attr_affine)

                    reduced_node_count[0] += 6
                    i += 6  # noqa
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
                    i += 8  # noqa

    def fuse_flatten(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # Flatten <= X - Shape - Gather - Constant - Unsqueeze - Unsqueeze - Concat - Reshape
            if node.op_type == "Shape":
                if self.node_reference[node.output[0]] != 1:
                    continue
                if i + 6 >= self.node_count:
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
                gather_axis = get_node_attr_i(node2, "axis")
                if gather_axis != 0:
                    continue

                # indices = 0
                if node2.input[1] not in self.weights:
                    continue

                gather_indices = get_node_attr_from_input_ai(
                    self.weights[node2.input[1]]
                )
                if gather_indices.size != 1 or gather_indices[0] != 0:
                    continue

                # axes = (0)
                unsqueeze_axes = get_node_attr_ai(node4, "axes")
                if unsqueeze_axes.size != 1 or unsqueeze_axes[0] != 0:
                    continue
                unsqueeze_axes2 = get_node_attr_ai(node5, "axes")
                if unsqueeze_axes2.size != 1 or unsqueeze_axes2[0] != 0:
                    continue

                # data = -1
                if node5.input[0] not in self.weights:
                    continue

                unsqueeze2_data = get_node_attr_from_input_ai(
                    self.weights[node5.input[0]]
                )
                if unsqueeze2_data.size != 1 or unsqueeze2_data[0] != -1:
                    continue

                # axis = 0
                concat_axis = get_node_attr_i(node6, "axis")
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
                i += 5  # noqa

    def fuse_pixelshuffle(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # PixelShuffle <= Reshape - Transpose - Reshape
            # PixelShuffle <= Reshape - Transpose - Constant - Reshape
            if node.op_type == "Reshape":
                if self.node_reference[node.output[0]] != 1:
                    continue

                if len(node.input) == 1:
                    shape = get_node_attr_ai(node, "shape")
                else:
                    # skip weight reshape
                    if node.input[1] not in self.weights:
                        continue

                    shape = get_node_attr_from_input_ai(self.weights[node.input[1]])

                # -1, 3, upscale_factor, upscale_factor, height, width
                if (
                    shape.size != 6
                    or (shape[0] != 1 and shape[0] != -1)
                    or shape[2] != shape[3]
                    or i + 2 >= self.node_count
                ):
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]

                if node3.op_type == "Constant":
                    if i + 3 >= self.node_count:
                        continue

                    node3 = self.mutable_graph_nodes[i + 3]

                if node2.op_type != "Transpose" or node3.op_type != "Reshape":
                    continue
                if self.node_reference[node2.output[0]] != 1:
                    continue

                # 0 1 4 2 5 3
                perm = get_node_attr_ai(node2, "perm")
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
                    shape3 = get_node_attr_ai(node3, "shape")
                else:
                    if node3.input[1] not in self.weights:
                        continue

                    shape3 = get_node_attr_from_input_ai(self.weights[node3.input[1]])

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
                if len(node3.input) == 2:
                    self.node_reference[node3.input[1]] -= 1

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)

                node3.op_type = "PixelShuffle"
                node3.input[0] = node.input[0]

                attr_group = AttributeProto(
                    name="scale_factor", i=shape[2], type=APT.INT
                )
                node3.attribute.append(attr_group)

                reduced_node_count[0] += 2
                i += 2  # noqa

    def fuse_reorg(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # PixelShuffle <= Reshape - Transpose - Reshape
            # PixelShuffle <= Reshape - Transpose - Constant - Reshape
            if node.op_type == "Reshape":
                if self.node_reference[node.output[0]] != 1:
                    continue

                if len(node.input) == 1:
                    shape = get_node_attr_ai(node, "shape")
                else:
                    if node.input[1] not in self.weights:
                        continue

                    shape = get_node_attr_from_input_ai(self.weights[node.input[1]])

                # -1, 3, out_height, block_size, out_width, block_size
                if (
                    shape.size != 6
                    or (shape[0] != 1 and shape[0] != -1)
                    or shape[3] != shape[5]
                    or i + 2 >= self.node_count
                ):
                    continue

                node2 = self.mutable_graph_nodes[i + 1]
                node3 = self.mutable_graph_nodes[i + 2]

                if node3.op_type == "Constant":
                    if i + 3 >= self.node_count:
                        continue

                    node3 = self.mutable_graph_nodes[i + 3]

                if node2.op_type != "Transpose" or node3.op_type != "Reshape":
                    continue
                if self.node_reference[node2.output[0]] != 1:
                    continue

                # 0 1 3 5 2 4
                perm = get_node_attr_ai(node2, "perm")
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
                    shape3 = get_node_attr_ai(node3, "shape")
                else:
                    if node3.input[1] not in self.weights:
                        continue

                    shape3 = get_node_attr_from_input_ai(self.weights[node3.input[1]])

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
                if len(node3.input) == 2:
                    self.node_reference[node3.input[1]] -= 1

                self.blob_names.pop(node.output[0], None)
                self.blob_names.pop(node2.output[0], None)

                node3.op_type = "Reorg"
                node3.input[0] = node.input[0]

                attr_group = AttributeProto(name="stride", i=shape[3], type=APT.INT)
                node3.attribute.append(attr_group)

                reduced_node_count[0] += 2
                i += 2  # noqa

    def fuse_expand_broadcast(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # Add/Sub/Mul/Div/Min/Max <= Expand - Add/Sub/Mul/Div/Min/Max
            if node.op_type == "Expand":
                if self.node_reference[node.output[0]] != 1 or i + 1 >= self.node_count:
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
                i += 1  # noqa

    def fuse_lstm_gru_rnn(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # LSTM(bi) <= LSTM(bi) - Transpose - Reshape - Transpose
            if node.op_type in ["LSTM", "GRU", "RNN"]:
                if self.node_reference[node.output[0]] != 1 or i + 2 >= self.node_count:
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

                direction = get_node_attr_s(node, "direction")
                if direction != "bidirectional":
                    continue

                # 0 2 1 3
                perm = get_node_attr_ai(node2, "perm")
                if (
                    perm.size != 4
                    or perm[0] != 0
                    or perm[1] != 2
                    or perm[2] != 1
                    or perm[3] != 3
                ):
                    continue

                if len(node3.input) == 1:
                    shape = get_node_attr_ai(node3, "shape")
                else:
                    if node3.input[1] not in self.weights:
                        continue

                    shape = get_node_attr_from_input_ai(self.weights[node3.input[1]])

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
                i += 2  # noqa

                if i + 1 < self.node_count:
                    if self.node_reference[node3.output[0]] != 1:
                        continue

                    node4 = self.mutable_graph_nodes[i + 1]

                    if node4.op_type != "Transpose":
                        continue
                    if node4.input[0] != node.output[0]:
                        continue

                    # 1 0 2
                    perm4 = get_node_attr_ai(node4, "perm")
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
                    i += 1  # noqa

        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # LSTM(uni) <= LSTM(uni) - Squeeze - Transpose
            if node.op_type in ["LSTM", "GRU", "RNN"]:
                if self.node_reference[node.output[0]] != 1 or i + 1 >= self.node_count:
                    continue

                node2 = self.mutable_graph_nodes[i + 1]

                if node2.op_type != "Squeeze":
                    continue
                if node2.input[0] != node.output[0]:
                    continue

                direction = get_node_attr_s(node, "direction")
                if direction == "bidirectional":
                    continue

                axes = get_node_attr_ai(node2, "axes")
                if axes.size != 1 or axes[0] != 1:
                    continue

                # reduce
                node2.op_type = "noop_reducedncnn"

                self.node_reference[node.output[0]] -= 1

                self.blob_names.pop(node.output[0], None)

                node.output[0] = node2.output[0]

                reduced_node_count[0] += 1
                i += 1  # noqa

                if i + 1 < self.node_count:
                    if self.node_reference[node2.output[0]] != 1:
                        continue

                    node3 = self.mutable_graph_nodes[i + 1]

                    if node3.op_type != "Transpose":
                        continue

                    if node3.input[0] != node.output[0]:
                        continue

                    # 1 0 2
                    perm4 = get_node_attr_ai(node3, "perm")
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
                    i += 1  # noqa

        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # LSTM <= Transpose - LSTM
            if node.op_type == "Transpose":
                if self.node_reference[node.output[0]] != 1:
                    continue

                # 1 0 2
                perm = get_node_attr_ai(node, "perm")
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
                i += 1  # noqa

    def fuse_multiheadattention(self, reduced_node_count: list[int]) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # MultiHeadAttention <= MatMul(q) - Add
            #                      - MatMul(k) - Add
            #                      - MatMul(v) - Add
            #                      - Mul
            #                      - Reshape - Transpose
            #                      - Reshape - Reshape - Transpose - Transpose
            #                      - Gemm - Softmax - Gemm - Transpose - Reshape - MatMul - Add
            if node.op_type == "MatMul":
                if (
                    self.node_reference[node.output[0]] != 1
                    or i + 19 >= self.node_count
                ):
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

                q_B = get_node_attr_from_input_af(self.weights[node2.input[1]])
                k_B = get_node_attr_from_input_af(self.weights[node4.input[1]])
                v_B = get_node_attr_from_input_af(self.weights[node6.input[1]])
                o_B = get_node_attr_from_input_af(self.weights[node20.input[1]])

                if q_B.size != k_B.size or q_B.size != v_B.size or q_B.size != o_B.size:
                    continue

                embed_dim = q_B.size

                # 1 0 2
                perm9 = get_node_attr_ai(node9, "perm")
                perm12 = get_node_attr_ai(node12, "perm")
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
                perm13 = get_node_attr_ai(node13, "perm")
                if (
                    perm13.size != 3
                    or perm13[0] != 1
                    or perm13[1] != 2
                    or perm13[2] != 0
                ):
                    continue

                # 1 0 2
                perm17 = get_node_attr_ai(node17, "perm")
                if (
                    perm17.size != 3
                    or perm17[0] != 1
                    or perm17[1] != 0
                    or perm17[2] != 2
                ):
                    continue

                softmax_axis = get_node_attr_i(node15, "axis")
                if softmax_axis != 2:
                    continue

                # 1/-1 seqlen * num_heads, embed_dim / num_heads
                if len(node8.input) == 1:
                    shape8 = get_node_attr_ai(node8, "shape")
                else:
                    if node8.input[1] not in self.weights:
                        continue

                    shape8 = get_node_attr_from_input_ai(self.weights[node8.input[1]])
                if len(node10.input) == 1:
                    shape10 = get_node_attr_ai(node10, "shape")
                else:
                    if node10.input[1] not in self.weights:
                        continue

                    shape10 = get_node_attr_from_input_ai(self.weights[node10.input[1]])
                if len(node11.input) == 1:
                    shape11 = get_node_attr_ai(node11, "shape")
                else:
                    if node11.input[1] not in self.weights:
                        continue

                    shape11 = get_node_attr_from_input_ai(self.weights[node11.input[1]])

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
                    shape18 = get_node_attr_ai(node18, "shape")
                else:
                    if node18.input[1] not in self.weights:
                        continue

                    shape18 = get_node_attr_from_input_ai(self.weights[node18.input[1]])

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

                attr_embed_dim = AttributeProto(
                    name="embed_dim", i=embed_dim, type=APT.INT
                )
                node20.attribute.append(attr_embed_dim)

                attr_num_heads = AttributeProto(
                    name="num_heads", i=num_heads, type=APT.INT
                )
                node20.attribute.append(attr_num_heads)

                reduced_node_count[0] += 19
                i += 19  # noqa

        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # MultiHeadAttention <= MatMul(qkv) - Add - Split
            #                      - Mul
            #                      - Reshape - Transpose
            #                      - Reshape - Reshape - Transpose - Transpose
            #                      - Gemm - Softmax - Gemm - Transpose - Reshape - MatMul - Add
            if node.op_type == "MatMul":
                if (
                    self.node_reference[node.output[0]] != 1
                    or i + 16 >= self.node_count
                ):
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

                qkv_B = get_node_attr_from_input_af(self.weights[node2.input[1]])
                o_B = get_node_attr_from_input_af(self.weights[node17.input[1]])

                if qkv_B.size != o_B.size * 3:
                    continue

                embed_dim = o_B.size

                # 1 0 2
                perm6 = get_node_attr_ai(node6, "perm")
                perm9 = get_node_attr_ai(node9, "perm")
                if perm6.size != 3 or perm6[0] != 1 or perm6[1] != 0 or perm6[2] != 2:
                    continue
                if perm9.size != 3 or perm9[0] != 1 or perm9[1] != 0 or perm9[2] != 2:
                    continue

                # 1 2 0
                perm10 = get_node_attr_ai(node10, "perm")
                if (
                    perm10.size != 3
                    or perm10[0] != 1
                    or perm10[1] != 2
                    or perm10[2] != 0
                ):
                    continue

                # 1 0 2
                perm14 = get_node_attr_ai(node14, "perm")
                if (
                    perm14.size != 3
                    or perm14[0] != 1
                    or perm14[1] != 0
                    or perm14[2] != 2
                ):
                    continue

                softmax_axis = get_node_attr_i(node12, "axis")
                if softmax_axis != 2:
                    continue

                # 1/-1, seqlen * num_heads, embed_dim / num_heads
                if len(node5.input) == 1:
                    shape5 = get_node_attr_ai(node5, "shape")
                else:
                    if node5.input[1] not in self.weights:
                        continue

                    shape5 = get_node_attr_from_input_ai(self.weights[node5.input[1]])
                if len(node7.input) == 1:
                    shape7 = get_node_attr_ai(node7, "shape")
                else:
                    if node7.input[1] not in self.weights:
                        continue

                    shape7 = get_node_attr_from_input_ai(self.weights[node7.input[1]])
                if len(node8.input) == 1:
                    shape8 = get_node_attr_ai(node8, "shape")
                else:
                    if node8.input[1] not in self.weights:
                        continue

                    shape8 = get_node_attr_from_input_ai(self.weights[node8.input[1]])

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
                    shape15 = get_node_attr_ai(node15, "shape")
                else:
                    if node15.input[1] not in self.weights:
                        continue

                    shape15 = get_node_attr_from_input_ai(self.weights[node15.input[1]])

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

                attr_embed_dim = AttributeProto(
                    name="embed_dim", i=embed_dim, type=APT.INT
                )
                node17.attribute.append(attr_embed_dim)

                attr_num_heads = AttributeProto(
                    name="num_heads", i=num_heads, type=APT.INT
                )
                node17.attribute.append(attr_num_heads)

                reduced_node_count[0] += 16
                i += 16  # noqa

    def fuse_binaryop_with_scalar(self) -> None:
        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # Add/Sub/Mul/Div/Min/Max/Pow(a, x)
            if node.op_type in ["Add", "Sub", "Mul", "Div", "Min", "Max", "Pow"]:
                if node.input[0] not in self.weights:
                    continue

                scalar_b = self.weights[node.input[0]]
                if (
                    len(scalar_b.dims) != 0
                    or get_tensor_proto_data_size(scalar_b, scalar_b.data_type) != 1
                ):
                    continue

                if node.op_type == "Sub":
                    node.op_type = "RSub"
                elif node.op_type == "Div":
                    node.op_type = "RDiv"

                b = get_node_attr_from_input_f(scalar_b)

                self.node_reference[node.input[0]] -= 1

                node_input = node.input[1]
                node.ClearField("input")
                node.input.append(node_input)

                attr_with_scalar = AttributeProto(name="with_scalar", i=1, type=APT.INT)
                node.attribute.append(attr_with_scalar)

                attr_b = AttributeProto(name="b", f=b, type=APT.FLOAT)
                node.attribute.append(attr_b)

        for i in range(self.node_count):
            node = self.mutable_graph_nodes[i]

            # Add/Sub/Mul/Div/Min/Max/Pow(x, b)
            if node.op_type in ["Add", "Sub", "Mul", "Div", "Min", "Max", "Pow"]:
                if node.input[1] not in self.weights:
                    continue

                scalar_b = self.weights[node.input[1]]
                if (
                    len(scalar_b.dims) != 0
                    or get_tensor_proto_data_size(scalar_b, scalar_b.data_type) != 1
                ):
                    continue

                b = get_node_attr_from_input_f(scalar_b)

                self.node_reference[node.input[1]] -= 1

                node_input = node.input[0]
                node.ClearField("input")
                node.input.append(node_input)

                attr_with_scalar = AttributeProto(name="with_scalar", i=1, type=APT.INT)
                node.attribute.append(attr_with_scalar)

                attr_b = AttributeProto(name="b", f=b, type=APT.FLOAT)
                node.attribute.append(attr_b)

    def convert(self, is_fp16: bool = False, include_mem_data: bool = True):
        if is_fp16:
            logger.debug("NCNN mode: fp16")
        else:
            logger.debug("NCNN mode: fp32")

        # Topological sort
        i = 0
        while i < self.node_count:
            node = self.mutable_graph_nodes[i]
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

                i += 1
                continue

            # find node that produces missing_input_name
            swap_j = 0
            for j, nodeq in enumerate(self.mutable_graph_nodes, i + 1):
                swap_j = j
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

            self.swap_nodes(i, swap_j)

        # global definition line
        # [layer count][blob count]
        for node in self.onnx_graph.node:
            op = node.op_type
            if not node.name:
                node.name = node.output[0]

            if op == "Constant":
                self.weights[node.output[0]] = get_node_attr_tensor(node, "value")

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
            elif op == "BiasGelu":
                self.node_reference[node.input[1]] -= 1
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
                alpha = get_node_attr_f(node, "alpha", 1)
                beta = get_node_attr_f(node, "beta", 1)
                transA = get_node_attr_i(node, "transA", 0)
                transB = get_node_attr_i(node, "transB", 0)

                if alpha == 1 and beta == 1 and transA == 0 and transB == 1:
                    # InnerProduct-like A * B + C
                    self.node_reference[node.input[1]] -= 1
                    self.node_reference[node.input[2]] -= 1
            elif op == "GroupNorm":
                affine = get_node_attr_i(node, "affine", 1)
                if affine:
                    self.node_reference[node.input[1]] -= 1
                    self.node_reference[node.input[2]] -= 1
            elif op == "GRU":
                for gru_input in node.input:
                    self.node_reference[gru_input] -= 1
            elif op == "InstanceNormalization":
                self.node_reference[node.input[1]] -= 1
                self.node_reference[node.input[2]] -= 1
            elif op == "LayerNorm":
                affine = get_node_attr_i(node, "affine", 1)
                if affine:
                    self.node_reference[node.input[1]] -= 1
                    self.node_reference[node.input[2]] -= 1
            elif op == "LSTM":
                for lstm_input in node.input:
                    self.node_reference[lstm_input] -= 1
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
                for rnn_input in node.input:
                    self.node_reference[rnn_input] -= 1
            elif op == "SkipLayerNormalization":
                self.node_reference[node.input[2]] -= 1
                self.node_reference[node.input[3]] -= 1
                self.node_reference[node.input[4]] -= 1
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
            elif op in ("adaptive_avg_pool2d", "adaptive_max_pool2d"):
                if len(node.input) >= 2:
                    self.node_reference[node.input[1]] -= 1

        # count all weight node with zero reference
        zero_reference_weight_node_count = 0
        for input_name in self.weights.keys():
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
            if node.op_type == "Constant":
                constant_node_count_moved_to_weight += 1

        # some ops may have anonymous input
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

        ncnn_node_count = (
            self.node_count
            - constant_node_count_moved_to_weight
            + len(self.weights)
            - zero_reference_weight_node_count
            - reduced_node_count[0]
            + input_node_count
            + split_layer_count
        )
        ncnn_blob_count = (
            len(self.blob_names)
            - zero_reference_weight_node_count
            + splitncnn_blob_count
        )
        ncnn_model = NcnnModel(ncnn_node_count, ncnn_blob_count)
        logger.debug(
            f"Node count: {ncnn_model.node_count}, Blob count: {ncnn_model.blob_count}"
        )

        bin_length = 0
        for i, graph_input in enumerate(self.onnx_graph.input):
            input_name = graph_input.name

            # Make sure input is not in weights
            if input_name not in self.weights:
                ncnn_model.add_layer(
                    NcnnLayer("Input", input_name, 0, 1, outputs=[input_name])
                )

                refcount = self.node_reference[input_name]
                if refcount > 1:
                    layer_input_list = [
                        f"{input_name}_splitncnn_{j}" for j in range(refcount)
                    ]
                    ncnn_model.add_layer(
                        NcnnLayer(
                            "Split",
                            f"splitncnn_input{i}",
                            1,
                            refcount,
                            [input_name],
                            layer_input_list,
                        )
                    )

        # place MemoryData next if it is being included
        internal_split = 0
        if include_mem_data:
            for input_name, M in self.weights.items():
                refcount = self.node_reference[input_name]
                if refcount != 0:
                    layer = NcnnLayer("MemoryData", input_name, 0, 1, [input_name])

                    M_dims_size = len(M.dims)
                    if M_dims_size == 0:
                        layer.add_param(0, get_tensor_proto_data_size(M, M.data_type))
                    elif M_dims_size == 1:
                        layer.add_param(0, M.dims[0])
                    elif M_dims_size == 2:
                        layer.add_param(0, M.dims[1])
                        if M.dims[0] != 1:
                            layer.add_param(1, M.dims[0])
                    elif M_dims_size == 3:
                        layer.add_param(0, M.dims[2])
                        layer.add_param(1, M.dims[1])
                        if M.dims[0] != 1:
                            layer.add_param(2, M.dims[0])
                    elif M_dims_size == 4:
                        layer.add_param(0, M.dims[3])
                        layer.add_param(1, M.dims[2])
                        layer.add_param(2, M.dims[1])

                    bin_length += self.add_weight(layer, "MemoryData", M)

                    ncnn_model.add_layer(layer)

                    if refcount > 1:
                        layer_output_list = [
                            f"{input_name}_splitncnn_{i}" for i in range(refcount)
                        ]
                        ncnn_model.add_layer(
                            NcnnLayer(
                                "Split",
                                f"splitncnn_{internal_split}",
                                1,
                                refcount,
                                [input_name],
                                layer_output_list,
                            )
                        )

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
                if not input_name or (
                    input_name in self.weights and self.node_reference[input_name] == 0
                ):
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
                layer.op_type = "UnaryOp"
            elif op in [
                "Add",
                "Div",
                "Max",
                "Min",
                "Mul",
                "Pow",
                "RDiv",
                "RSub",
                "Sub",
            ]:
                layer.op_type = "BinaryOp"
            elif op in ("AveragePool", "MaxPool"):
                kernel_shape = get_node_attr_ai(node, "kernel_shape")
                if kernel_shape.size == 1:
                    layer.op_type = "Pooling1D"
                else:
                    layer.op_type = "Pooling"
            elif op == "BatchNormalization":
                layer.op_type = "BatchNorm"
            elif op == "BiasGelu":
                layer.op_type = "BiasGelu"
            elif op == "Clip":
                layer.op_type = "Clip"
            elif op == "Concat":
                layer.op_type = "Concat"
            elif op == "Constant":
                continue
            elif op == "Conv":
                kernel_shape = get_node_attr_ai(node, "kernel_shape")
                if kernel_shape.size == 1:
                    layer.op_type = "Convolution1D"
                else:
                    group = get_node_attr_i(node, "group", 1)
                    if group > 1:
                        layer.op_type = "ConvolutionDepthWise"
                    else:
                        layer.op_type = "Convolution"
            elif op == "ConvTranspose":
                group = get_node_attr_i(node, "group", 1)
                if group > 1:
                    layer.op_type = "DeconvolutionDepthWise"
                else:
                    layer.op_type = "Deconvolution"
            elif op in ("Crop", "Slice"):
                layer.op_type = "Crop"
            elif op in ("DepthToSpace", "PixelShuffle"):
                layer.op_type = "PixelShuffle"
            elif op == "Dropout":
                layer.op_type = "Dropout"
                output_size = 1
            elif op == "Elu":
                layer.op_type = "ELU"
            elif op == "EmbedLayerNormalization":
                layer.op_type = "EmbedLayerNormalization"
            elif op == "Flatten":
                layer.op_type = "Flatten"
            elif op == "Gelu":
                layer.op_type = "GELU"
            elif op == "Gemm":
                alpha = get_node_attr_f(node, "alpha", 1)
                beta = get_node_attr_f(node, "beta", 1)
                transA = get_node_attr_i(node, "transA", 0)
                transB = get_node_attr_i(node, "transB", 0)

                if alpha == 1 and beta == 1 and transA == 0 and transB == 1:
                    # InnerProduct-like A * B + C
                    layer.op_type = "InnerProduct"
                else:
                    layer.op_type = "Gemm"
            elif op in [
                "GlobalAveragePool",
                "GlobalMaxPool",
                "adaptive_avg_pool2d",
                "adaptive_max_pool2d",
            ]:
                layer.op_type = "Pooling"
            elif op == "GroupNorm":
                layer.op_type = "GroupNorm"
            elif op == "GRU":
                layer.op_type = "GRU"
            elif op == "HardSigmoid":
                layer.op_type = "HardSigmoid"
            elif op == "HardSwish":
                layer.op_type = "HardSwish"
            elif op == "ImageScaler":
                layer.op_type = "Scale"
            elif op == "InstanceNormalization":
                layer.op_type = "InstanceNorm"
            elif op == "LayerNorm":
                layer.op_type = "LayerNorm"
            elif op in ("LeakyRelu", "Relu"):
                layer.op_type = "ReLU"
            elif op == "LRN":
                layer.op_type = "LRN"
            elif op == "LSTM":
                layer.op_type = "LSTM"
            elif op == "MatMul":
                if (
                    node.input[1] in self.weights
                    and len(self.weights[node.input[1]].dims) == 2
                ):
                    layer.op_type = "InnerProduct"
                else:
                    layer.op_type = "Gemm"
            elif op == "MultiHeadAttention":
                layer.op_type = "MultiHeadAttention"
            elif op == "Normalize":
                layer.op_type = "Normalize"
            elif op == "Pad":
                layer.op_type = "Padding"
            elif op == "PRelu":
                layer.op_type = "PReLU"
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
                layer.op_type = "Reduction"
            elif op == "Reorg":
                layer.op_type = "Reorg"
            elif op == "Reshape":
                layer.op_type = "Reshape"
            elif op == "RNN":
                layer.op_type = "RNN"
            elif op == "ShuffleChannel":
                layer.op_type = "ShuffleChannel"
            elif op == "Sigmoid":
                layer.op_type = "Sigmoid"
            elif op == "SkipLayerNormalization":
                layer.op_type = "SkipLayerNormalization"
            elif op == "Softmax":
                layer.op_type = "Softmax"
            elif op == "Softplus":
                layer.op_type = "Softplus"
            elif op == "Split":
                layer.op_type = "Slice"
            elif op == "Squeeze":
                layer.op_type = "Squeeze"
            elif op == "Sum":
                layer.op_type = "Eltwise"
            elif op == "Swish":
                layer.op_type = "Swish"
            elif op == "Transpose":
                layer.op_type = "Permute"
            elif op in ("Upsample", "Resize"):
                layer.op_type = "Interp"
            elif op == "Unsqueeze":
                layer.op_type = "ExpandDims"
            else:
                error_msg = f"{op} not currently supported by NCNN."
                raise ValueError(error_msg)

            layer.name = name
            layer.num_inputs = input_size
            layer.num_outputs = output_size
            layer.params.set_op(layer.op_type)

            for input_name in node.input:
                # check weight
                if input_name and not (
                    input_name in self.weights and self.node_reference[input_name] == 0
                ):
                    if input_name in split_node_reference:
                        refidx = split_node_reference[input_name] - 1
                        split_node_reference[input_name] = refidx
                        input_name = f"{input_name}_splitncnn_{refidx}"  # noqa

                    layer.inputs.append(input_name)

            for o in range(output_size):
                layer.outputs.append(node.output[o])

            if op == "Abs":
                layer.add_param(0, UOT.ABS)
            elif op == "Acos":
                layer.add_param(0, UOT.ACOS)
            elif layer.op_type == "BinaryOp":
                if op == "Add":
                    layer.add_param(0, BOT.ADD)
                elif op == "Div":
                    layer.add_param(0, BOT.DIV)
                elif op == "Max":
                    layer.add_param(0, BOT.MAX)
                elif op == "Min":
                    layer.add_param(0, BOT.MIN)
                elif op == "Mul":
                    layer.add_param(0, BOT.MUL)
                elif op == "Pow":
                    layer.add_param(0, BOT.POW)
                elif op == "RDiv":
                    layer.add_param(0, BOT.RDIV)
                elif op == "RSub":
                    layer.add_param(0, BOT.RSUB)
                elif op == "Sub":
                    layer.add_param(0, BOT.SUB)

                with_scalar = get_node_attr_i(node, "with_scalar", 0)
                b = get_node_attr_f(node, "b", 0)
                if with_scalar:
                    layer.add_param(1, with_scalar)
                    layer.add_param(2, b)
            elif op == "Asin":
                layer.add_param(0, UOT.ASIN)
            elif op == "Atan":
                layer.add_param(0, UOT.ATAN)
            elif op in ("AveragePool", "MaxPool"):
                auto_pad = get_node_attr_s(node, "auto_pad")
                ceil_mode = get_node_attr_i(node, "ceil_mode", 0)
                kernel_shape = get_node_attr_ai(node, "kernel_shape")
                strides = get_node_attr_ai(node, "strides")
                pads = get_node_attr_ai(node, "pads")

                pool = int(op == "AveragePool")

                if ceil_mode == 1:
                    pad_mode = PAM.FULL
                elif auto_pad == "SAME_UPPER":
                    pad_mode = PAM.SAMEUPPER
                elif auto_pad == "SAME_LOWER":
                    pad_mode = PAM.SAMELOWER
                else:
                    pad_mode = PAM.VALID

                layer.add_param(0, pool)

                if kernel_shape.size == 1:
                    layer.add_param(1, int(kernel_shape[0]))
                elif kernel_shape.size == 2:
                    layer.add_param(1, int(kernel_shape[1]))
                    layer.add_param(11, int(kernel_shape[0]))

                if strides.size == 1:
                    layer.add_param(2, int(strides[0]))
                elif strides.size == 2:
                    layer.add_param(2, int(strides[1]))
                    layer.add_param(12, int(strides[0]))

                if pads.size == 1:
                    layer.add_param(3, int(pads[0]))
                elif pads.size == 2:
                    layer.add_param(3, int(pads[1]))
                    layer.add_param(13, int(pads[0]))
                elif pads.size == 4:
                    layer.add_param(3, int(pads[1]))
                    layer.add_param(13, int(pads[0]))
                    layer.add_param(14, int(pads[3]))
                    layer.add_param(15, int(pads[2]))

                layer.add_param(5, pad_mode)

                if pool:
                    avgpool_count_include_pad = get_node_attr_i(
                        node, "count_include_pad", 0
                    )
                    layer.add_param(6, avgpool_count_include_pad)
            elif op == "BatchNormalization":
                epsilon = get_node_attr_f(node, "epsilon", 0.00001)
                scale = self.weights[node.input[1]]
                B = self.weights[node.input[2]]
                mean = self.weights[node.input[3]]
                var = self.weights[node.input[4]]
                channels = get_tensor_proto_data_size(scale, scale.data_type)

                layer.add_param(0, channels)

                bin_length += self.add_weight(layer, "slope", scale)
                bin_length += self.add_weight(layer, "mean", mean)

                # apply epsilon to var
                v = onph.to_array(var)
                ve = np.array([v[i] + epsilon for i in range(channels)], np.float32)
                bin_length += self.add_weight(layer, "variance", ve)
                bin_length += self.add_weight(layer, "bias", B)
            elif op == "BiasGelu":
                B = self.weights[node.input[1]]

                layer.add_param(0, get_tensor_proto_data_size(B, B.data_type))

                bin_length += self.add_weight(layer, "bias", B)
            elif op == "Ceil":
                layer.add_param(0, UOT.CEIL)
            elif op == "Clip":
                if len(node.input) == 1:
                    minimum = get_node_attr_f(node, "min", -FLOAT32_MAX)
                    maximum = get_node_attr_f(node, "max", FLOAT32_MAX)
                else:
                    minimum = (
                        get_node_attr_from_input_f(self.weights[node.input[1]])
                        if node.input[1] in self.weights
                        else -FLOAT32_MAX
                    )
                    maximum = (
                        get_node_attr_from_input_f(self.weights[node.input[2]])
                        if node.input[2] in self.weights
                        else FLOAT32_MAX
                    )

                layer.add_param(0, minimum)
                layer.add_param(1, maximum)
            elif op == "Concat":
                axis = get_node_attr_i(node, "axis", 1)
                layer.add_param(0, axis - 1 if axis > 0 else axis)
            elif op == "Constant":
                logger.error("Code should not have reached inside Constant.")
            elif op == "Conv":
                W = self.weights[node.input[1]]

                num_filter = W.dims[0]
                has_bias = int(len(node.input) == 3)

                auto_pad = get_node_attr_s(node, "auto_pad")
                kernel_shape = get_node_attr_ai(node, "kernel_shape")
                dilations = get_node_attr_ai(node, "dilations")
                strides = get_node_attr_ai(node, "strides")
                pads = get_node_attr_ai(node, "pads")
                group = get_node_attr_i(node, "group", 1)

                layer.add_param(0, num_filter)

                if kernel_shape.size == 1:
                    layer.add_param(1, int(kernel_shape[0]))
                elif kernel_shape.size == 2:
                    layer.add_param(1, int(kernel_shape[1]))
                    layer.add_param(11, int(kernel_shape[0]))

                if dilations.size == 1:
                    layer.add_param(2, int(dilations[0]))
                elif dilations.size == 2:
                    layer.add_param(2, int(dilations[1]))
                    layer.add_param(12, int(dilations[0]))

                if strides.size == 1:
                    layer.add_param(3, int(strides[0]))
                elif strides.size == 2:
                    layer.add_param(3, int(strides[1]))
                    layer.add_param(13, int(strides[0]))

                if auto_pad == "SAME_UPPER":
                    layer.add_param(4, -233)
                elif auto_pad == "SAME_LOWER":
                    layer.add_param(4, -234)
                elif pads.size == 1:
                    layer.add_param(4, int(pads[0]))
                elif pads.size == 2:
                    layer.add_param(4, int(pads[1]))
                    layer.add_param(14, int(pads[0]))
                elif pads.size == 4:
                    layer.add_param(4, int(pads[1]))
                    layer.add_param(14, int(pads[0]))
                    layer.add_param(15, int(pads[3]))
                    layer.add_param(16, int(pads[2]))

                layer.add_param(5, has_bias)

                layer.add_param(6, get_tensor_proto_data_size(W, W.data_type))

                if group > 1:
                    layer.add_param(7, int(group))

                quantize_tag = DTYPE_FP16 if is_fp16 else DTYPE_FP32
                bin_length += self.add_weight(layer, "weight", W, quantize_tag)

                if has_bias:
                    B = self.weights[node.input[2]]
                    bin_length += self.add_weight(layer, "bias", B)
            elif op == "ConvTranspose":
                W = self.weights[node.input[1]]

                has_bias = int(len(node.input) == 3)

                auto_pad = get_node_attr_s(node, "auto_pad")
                kernel_shape = get_node_attr_ai(node, "kernel_shape")
                dilations = get_node_attr_ai(node, "dilations")
                strides = get_node_attr_ai(node, "strides")
                output_padding = get_node_attr_ai(node, "output_padding")
                output_shape = get_node_attr_ai(node, "output_shape")
                pads = get_node_attr_ai(node, "pads")
                group = get_node_attr_i(node, "group", 1)
                num_filter = W.dims[1] * group

                layer.add_param(0, num_filter)

                if kernel_shape.size == 1:
                    layer.add_param(1, int(kernel_shape[0]))
                elif kernel_shape.size == 2:
                    layer.add_param(1, int(kernel_shape[1]))
                    layer.add_param(11, int(kernel_shape[0]))

                if dilations.size == 1:
                    layer.add_param(2, int(dilations[0]))
                elif dilations.size == 2:
                    layer.add_param(2, int(dilations[1]))
                    layer.add_param(12, int(dilations[0]))

                if strides.size == 1:
                    layer.add_param(3, int(strides[0]))
                elif strides.size == 2:
                    layer.add_param(3, int(strides[1]))
                    layer.add_param(13, int(strides[0]))

                if auto_pad == "SAME_UPPER":
                    layer.add_param(4, -233)
                elif auto_pad == "SAME_LOWER":
                    layer.add_param(4, -234)
                elif pads.size == 1:
                    layer.add_param(4, int(pads[0]))
                elif pads.size == 2:
                    layer.add_param(4, int(pads[1]))
                    layer.add_param(14, int(pads[0]))
                elif pads.size == 4:
                    layer.add_param(4, int(pads[1]))
                    layer.add_param(14, int(pads[0]))
                    layer.add_param(15, int(pads[3]))
                    layer.add_param(16, int(pads[2]))

                if output_padding.size == 1:
                    layer.add_param(18, int(output_padding[0]))
                elif output_padding.size == 2:
                    layer.add_param(18, int(output_padding[1]))
                    layer.add_param(19, int(output_padding[0]))

                if output_shape.size == 1:
                    layer.add_param(20, int(output_shape[0]))
                elif output_shape == 2:
                    layer.add_param(20, int(output_shape[1]))
                    layer.add_param(21, int(output_shape[0]))

                layer.add_param(5, has_bias)

                weight_data_size = get_tensor_proto_data_size(W, W.data_type)
                layer.add_param(6, weight_data_size)

                if group > 1:
                    layer.add_param(7, group)

                quantize_tag = DTYPE_FP16 if is_fp16 else DTYPE_FP32
                weight_data = onph.to_array(W)
                bin_length += self.add_weight(
                    layer, "weight", weight_data.swapaxes(0, 1), quantize_tag
                )

                if has_bias:
                    B = self.weights[node.input[2]]
                    bin_length += self.add_weight(layer, "bias", B)
            elif op == "Cos":
                layer.add_param(0, UOT.COS)
            elif op == "Crop":
                starts = get_node_attr_ai(node, "starts")
                layer.add_param(9, [starts.size, *starts])

                ends = get_node_attr_ai(node, "ends")
                layer.add_param(10, [ends.size, *ends])

                axes = get_node_attr_ai(node, "axis")
                layer.add_param(11, [axes.size, *axes])
            elif op == "DepthToSpace":
                # pixelshuffle
                scale_factor = get_node_attr_i(node, "blocksize", 1)
                mode = get_node_attr_s(node, "mode")
                layer.add_param(0, scale_factor)
                if mode == "CRD":
                    layer.add_param(1, 0)
                elif mode == "DCR":
                    layer.add_param(1, 1)
            elif op == "Dropout":
                pass
            elif op == "Elu":
                alpha = get_node_attr_f(node, "alpha", 1)
                layer.add_param(0, alpha)
            elif op == "EmbedLayerNormalization":
                logger.error(f"No NCNN documentation for {op} yet, will not function")
                words = self.weights[node.input[2]]
                positions = self.weights[node.input[3]]
                W = self.weights[node.input[5]]
                B = self.weights[node.input[6]]

                layer.add_param(0, get_tensor_proto_data_size(B, B.data_type))
                layer.add_param(1, get_tensor_proto_data_size(words, words.data_type))
                layer.add_param(
                    2, get_tensor_proto_data_size(positions, positions.data_type)
                )

                quantize_tag = DTYPE_FP16 if is_fp16 else DTYPE_FP32
                bin_length += self.add_weight(layer, "words", words, DTYPE_FP32)
                bin_length += self.add_weight(layer, "positions", positions, DTYPE_FP32)
                bin_length += self.add_weight(layer, "weight", W, quantize_tag)
                bin_length += self.add_weight(layer, "bias", B)
            elif op == "Exp":
                layer.add_param(0, UOT.EXP)
            elif op == "Flatten":
                axis = get_node_attr_i(node, "axis", 1)
                if axis != 1:
                    raise ValueError(f"Unsupported Flatten axis {axis}.")
            elif op == "Floor":
                layer.add_param(0, UOT.FLOOR)
            elif op == "Gelu":
                layer.add_param(0, 1)
            elif op == "Gemm":
                alpha = get_node_attr_f(node, "alpha", 1)
                beta = get_node_attr_f(node, "beta", 1)
                transA = get_node_attr_i(node, "transA", 0)
                transB = get_node_attr_i(node, "transB", 0)

                if alpha == 1 and beta == 1 and transA == 0 and transB == 1:
                    # InnerProduct-like A * B * C
                    B = self.weights[node.input[1]]
                    C = self.weights[node.input[2]]

                    layer.add_param(0, get_tensor_proto_data_size(C, C.data_type))
                    layer.add_param(1, 1)
                    layer.add_param(2, get_tensor_proto_data_size(B, B.data_type))

                    quantize_tag = DTYPE_FP16 if is_fp16 else DTYPE_FP32
                    bin_length += self.add_weight(layer, "B", B, quantize_tag)
                    bin_length += self.add_weight(layer, "C", C)
                else:
                    # gemm
                    layer.add_param(0, alpha)
                    layer.add_param(1, beta)
                    layer.add_param(2, transA)
                    layer.add_param(3, transB)
            elif op in ("GlobalAveragePool", "GlobalMaxPool"):
                layer.add_param(0, int(op == "GlobalAveragePool"))
                layer.add_param(4, 1)
            elif op in ("adaptive_avg_pool2d", "adaptive_max_pool2d"):
                out_shape_tp = self.weights[node.input[1]]
                out_shape = get_node_attr_from_input_ai(out_shape_tp)

                layer.add_param(0, int(op == "adaptive_avg_pool2d"))
                layer.add_param(7, 1)
                if out_shape.size == 1:
                    layer.add_param(8, int(out_shape[0]))
                elif out_shape.size == 2:
                    layer.add_param(8, int(out_shape[1]))  # out_w
                    layer.add_param(18, int(out_shape[0]))  # out_h
            elif op == "GroupNorm":
                groups = get_node_attr_i(node, "groups", 1)
                channels = get_node_attr_i(node, "channels", 1)
                eps = get_node_attr_f(node, "epsilon", 0.00001)
                affine = get_node_attr_i(node, "affine", 1)

                if affine:
                    # discard affine-less S=1 B=0
                    affine_S = get_node_attr_from_input_af(self.weights[node.input[1]])
                    affine_B = get_node_attr_from_input_af(self.weights[node.input[2]])
                    if (
                        affine_S.size == 1
                        and affine_S[0] == 1
                        and affine_B.size == 1
                        and affine_B[0] == 0
                    ):
                        affine = 0
                    elif np.any(affine_S[:channels] != 1) or np.any(
                        affine_B[:channels] != 0
                    ):
                        affine = 1
                    else:
                        affine = 0

                layer.add_param(0, groups)
                layer.add_param(1, channels)
                layer.add_param(2, eps)
                layer.add_param(3, affine)
                if affine:
                    scale = self.weights[node.input[1]]
                    B = self.weights[node.input[2]]

                    bin_length += self.add_weight(layer, "scale", scale)
                    bin_length += self.add_weight(layer, "bias", B)
            elif op == "GRU":
                # W = self.weights[node.input[1]]
                # R = self.weights[node.input[2]]
                # B = self.weights[node.input[3]]

                # hidden_size = get_node_attr_i(node, "hidden_size", 0)
                # direction = get_node_attr_s(node, "direction")

                # if direction == "forward":
                #    direction_type = GRU.FORWARD
                # elif direction == "reverse":
                #    direction_type = GRU.REVERSE
                # elif direction == "bidirectional":
                #    direction_type = GRU.BIDIRECTIONAL

                # weight_data_size = get_tensor_proto_data_size(W)

                # layer.add_param(0, hidden_size)
                # layer.add_param(1, weight_data_size)
                # layer.add_param(2, direction_type)

                # num_directions = 2 if direction_type == GRU.BIDIRECTIONAL else 1

                # reorder num_directions-URN-hidden_size to num_directions-RUN-hidden_size
                # quantize_tag = DTYPE_FP16 if is_fp16 else DTYPE_FP32

                # logger.error(
                #    "Not sure GRU weight reordering is accurate, "
                #    "docs and code comments appear to give different shape orders"
                # )

                # W_array = onph.to_array(W)
                # W_array = np.stack(
                #    (W_array[:, 1, :], W_array[:, 0, :], W_array[:, 2, :]), axis=1
                # )
                # bin_length += self.add_weight(layer, W_array, "weight_xc_data", quantize_tag, is_fp16)

                # reduce U and R bias except N
                # reorder num_directions-URN-hidden to num_directions-RUN-hidden
                # B_array = onph.to_array(B)

                # bias_data_size_g = B_array.size / 6 / num_directions
                # for i in range(bias_data_size_g)[1:]:
                #    pass
                raise RuntimeError(
                    "GRU not implemented yet, please report issue with model used"
                )
            elif op in ("HardSigmoid", "Hard Swish"):
                alpha = get_node_attr_f(node, "alpha", 0.2)
                beta = get_node_attr_f(node, "beta", 0.5)

                layer.add_param(0, alpha)
                layer.add_param(1, beta)
            elif op == "ImageScaler":
                bias = get_node_attr_af(node, "bias")
                scale = get_node_attr_f(node, "scale", 1)
                channels = bias.size

                layer.add_param(0, channels)
                layer.add_param(1, 1)

                bin_length += self.add_weight(layer, "scale", np.array((scale,) * 3))
                bin_length += self.add_weight(layer, "bias", bias)
            elif op == "InstanceNormalization":
                eps = get_node_attr_f(node, "epsilon", 0.00001)

                # Discard affine-less S=1 B=0
                affine_S = get_node_attr_from_input_af(self.weights[node.input[1]])
                affine_B = get_node_attr_from_input_af(self.weights[node.input[2]])
                channels = affine_S.size

                if np.any(affine_S[:channels] != 1) or np.any(affine_B[:channels] != 0):
                    affine = 1
                else:
                    affine = 0

                layer.add_param(0, channels)
                layer.add_param(1, eps)
                layer.add_param(2, affine)
                if affine:
                    scale = self.weights[node.input[1]]
                    B = self.weights[node.input[2]]

                    bin_length += self.add_weight(layer, "scale", scale)
                    bin_length += self.add_weight(layer, "bias", B)
            elif op == "LayerNorm":
                eps = get_node_attr_f(node, "epsilon", 0.00001)
                affine = get_node_attr_i(node, "affine", 1)

                if affine:
                    # discard affine-less S=1 B=0
                    affine_S = get_node_attr_from_input_af(self.weights[node.input[1]])
                    affine_B = get_node_attr_from_input_af(self.weights[node.input[2]])
                    affine_size = affine_S.size

                    if np.any(affine_S[:affine_size] != 1) or np.any(
                        affine_B[:affine_size]
                    ):
                        affine = 1
                    else:
                        affine = 0

                    if affine:
                        layer.add_param(0, affine_size)

                layer.add_param(1, eps)
                layer.add_param(2, affine)

                if affine:
                    scale = self.weights[node.input[1]]
                    B = self.weights[node.input[2]]

                    bin_length += self.add_weight(layer, "scale", scale)
                    bin_length += self.add_weight(layer, "bias", B)
            elif op == "LeakyRelu":
                alpha = get_node_attr_f(node, "alpha", 0.01)
                layer.add_param(0, alpha)
            elif op == "Log":
                layer.add_param(0, UOT.LOG)
            elif op == "LRN":
                layer.add_param(0, 0)
                layer.add_param(1, get_node_attr_i(node, "size", 1))
                layer.add_param(2, get_node_attr_f(node, "alpha", 1))
                layer.add_param(3, get_node_attr_f(node, "beta", 0.5))
                layer.add_param(4, get_node_attr_f(node, "bias", 1))
            elif op == "LSTM":
                # W = self.weights[node.input[1]]
                # R = self.weights[node.input[2]]
                # B = self.weights[node.input[3]]

                # hidden_size = get_node_attr_i(node, "hidden_size", 0)
                # direction = get_node_attr_s(node, "direction")

                # if direction == "forward":
                #    direction_type = GRU.FORWARD
                # elif direction == "reverse":
                #    direction_type = GRU.REVERSE
                # elif direction  == "bidirectional":
                #    direction_type = GRU.BIDIRECTIONAL
                raise RuntimeError(
                    "LSTM not implemented yet, please report issue with model used"
                )
            elif op == "MatMul":
                if node.input[1] in self.weights:
                    # InnerProduct
                    B = self.weights[node.input[1]]
                    weight_data_size = get_tensor_proto_data_size(B, B.data_type)
                    num_output = B.dims[-1]

                    layer.add_param(0, num_output)
                    layer.add_param(1, 0)
                    layer.add_param(2, weight_data_size)

                    B_array = onph.to_array(B)
                    bin_length += self.add_weight(layer, "bias", B_array.T, DTYPE_FP32)
                # There is a dead else here, not sure if this was incomplete code
            elif op == "MultiHeadAttention":
                # embed_dim = get_node_attr_i(node, "embed_dim", 0)
                # num_heads = get_node_attr_i(node, "num_heads", 0)

                # layer.add_param(0, embed_dim)
                # layer.add_param(1, num_heads)

                # if len(node.input) == 5:
                #    qkvw = self.weights[node.input[1]]
                #    qkvb = self.weights[node.input[2]]
                #    ow = self.weights[node.input[3]]
                #    ob = self.weights[node.input[4]]

                #    weight_data_size = get_tensor_proto_data_size(ow)

                #    layer.add_param(2, weight_data_size)

                #    quantize_tag = DTYPE_FP16 if is_fp16 else DTYPE_FP32
                raise RuntimeError(
                    "MultiHeadAttention not implemented, please report issue with model used"
                )
            elif op == "Neg":
                layer.add_param(0, UOT.NEG)
            elif op == "Normalize":
                eps = get_node_attr_f(node, "eps", 0)

                layer.add_param(1, 1)  # channel_shared
                layer.add_param(2, eps)
                layer.add_param(3, 1)  # scale_data_size
                layer.add_param(9, NEM.PYTORCH)

                bin_length += self.add_weight(layer, "scale", 1)
            elif op == "Pad":
                mode = get_node_attr_s(node, "mode")
                value = get_node_attr_f(node, "value", 0)

                if len(node.input) == 1:
                    pads = get_node_attr_ai(node, "pads")
                else:
                    pads = get_node_attr_from_input_ai(self.weights[node.input[1]])

                if mode == "edge":
                    ptype = PAT.REPLICATE
                elif mode == "reflect":
                    ptype = PAT.REFLECT
                else:
                    ptype = PAT.CONSTANT

                pad_size = pads.size
                top = bottom = front = behind = 0
                if pad_size == 8:
                    # NCHW
                    top = pads[2]
                    bottom = pads[6]
                    left = pads[3]
                    right = pads[7]
                    front = pads[1]
                    behind = pads[5]
                elif pad_size == 6:
                    # NHW
                    top = pads[1]
                    bottom = pads[4]
                    left = pads[2]
                    right = pads[5]
                else:
                    # NW
                    left = pads[1]
                    right = pads[3]

                layer.add_param(0, int(top))
                layer.add_param(1, int(bottom))
                layer.add_param(2, int(left))
                layer.add_param(3, int(right))
                layer.add_param(4, int(ptype))
                layer.add_param(5, int(value))
                layer.add_param(7, int(front))
                layer.add_param(8, int(behind))
            elif op == "PixelShuffle":
                layer.add_param(0, get_node_attr_i(node, "scale_factor", 1))
            elif op == "PRelu":
                slope = self.weights[node.input[1]]
                num_slope = get_tensor_proto_data_size(slope, slope.data_type)

                layer.add_param(0, num_slope)

                bin_length += self.add_weight(layer, "slope", slope)
            elif op == "Reciprocal":
                layer.add_param(0, UOT.RECIPROCAL)
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
                if op == "ReduceSum":
                    op_type = ROT.SUM
                elif op == "ReduceSumSquare":
                    op_type = ROT.SUMSQ
                elif op == "ReduceMean":
                    op_type = ROT.MEAN
                elif op == "ReduceMax":
                    op_type = ROT.MAX
                elif op == "ReduceMin":
                    op_type = ROT.MIN
                elif op == "ReduceProd":
                    op_type = ROT.PROD
                elif op == "ReduceL1":
                    op_type = ROT.L1
                elif op == "ReduceL2":
                    op_type = ROT.L2
                elif op == "ReduceLogSum":
                    op_type = ROT.LOGSUM
                elif op == "ReduceLogSumExp":
                    op_type = ROT.LOGSUMEXP
                else:
                    op_type = -233

                layer.add_param(0, op_type)

                axes = get_node_attr_ai(node, "axes")
                keepdims = get_node_attr_i(node, "keepdims", 1)

                if axes.size > 0:
                    # if axes set, reduce according to axes
                    layer.add_param(1, 0)

                    for axis in axes:
                        if axis == 0 or axis > 4 or axis < -3:
                            raise ValueError(f"Unsupported axis {axis} in Reduction")
                    layer.add_param(
                        3,
                        [axes.size, *[a - 1 if a > 0 else a for a in axes]],
                    )
                else:
                    # if axes not set, reduce all axes by default
                    layer.add_param(1, 1)

                layer.add_param(4, keepdims)
                logger.error("No NCNN documentation for Reduction param 5")
                layer.add_param(5, 1)
            elif op == "Reorg":
                layer.add_param(0, get_node_attr_i(node, "stride", 1))
            elif op == "Reshape":
                if len(node.input) == 1:
                    shape = get_node_attr_ai(node, "shape")
                else:
                    shape = get_node_attr_from_input_ai(self.weights[node.input[1]])

                shape_size = shape.size
                if shape_size == 1:
                    logger.error("Should never reach shape.size == 1 in Reshape")
                    layer.add_param(0, int(shape[0]))
                elif shape_size == 2:
                    layer.add_param(0, int(shape[1]))
                elif shape_size == 3:
                    layer.add_param(0, int(shape[2]))
                    layer.add_param(1, int(shape[1]))
                elif shape_size == 4:
                    layer.add_param(0, int(shape[3]))
                    layer.add_param(1, int(shape[2]))
                    layer.add_param(2, int(shape[1]))
                elif shape_size == 5:
                    layer.add_param(0, int(shape[3] * shape[3]))
                    layer.add_param(1, int(shape[2]))
                    layer.add_param(2, int(shape[1]))
            elif op == "Resize":
                mode = get_node_attr_s(node, "mode")
                align = get_node_attr_s(node, "coordinate_transformation_mode")

                if len(node.input) == 2:
                    # opset 10
                    scales = get_node_attr_from_input_af(self.weights[node.input[1]])
                    sizes = np.empty(0, np.int32)
                else:
                    # opset 11+
                    scales = get_node_attr_from_input_af(self.weights[node.input[2]])
                    if len(node.input) >= 4:
                        sizes = get_node_attr_from_input_ai(self.weights[node.input[3]])
                    else:
                        sizes = np.empty(0, np.int32)

                if mode == "linear":
                    resize_type = IRT.BILINEAR
                elif mode == "cubic":
                    resize_type = IRT.BICUBIC
                else:
                    resize_type = IRT.NEAREST

                if scales.size == 0 and sizes.size == 0:
                    raise ValueError(
                        "Unsupported Resize scales and sizes are all empty."
                    )

                if scales.size == 2:
                    h_scale = 1
                    w_scale = scales[1]
                elif scales.size == 3:
                    h_scale = scales[1]
                    w_scale = scales[2]
                elif scales.size == 4:
                    if scales[1] != 1:
                        raise TypeError(f"Unsupported Resize scales {scales}.")
                    h_scale = scales[2]
                    w_scale = scales[3]
                else:
                    h_scale = 1
                    w_scale = 1

                if sizes.size == 2:
                    output_height = 0
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

                layer.add_param(0, resize_type)
                layer.add_param(1, float(h_scale))
                layer.add_param(2, float(w_scale))
                layer.add_param(3, int(output_height))
                layer.add_param(4, int(output_width))
                layer.add_param(6, align_corner)
            elif op == "RNN":
                W = self.weights[node.input[1]]
                R = self.weights[node.input[2]]
                B = self.weights[node.input[3]]

                hidden_size = get_node_attr_i(node, "hidden_size", 0)
                direction = get_node_attr_s(node, "direction")

                if direction == "reverse":
                    direction_type = GRU.REVERSE
                elif direction == "bidirectional":
                    direction_type = GRU.BIDIRECTIONAL
                else:
                    direction_type = GRU.FORWARD

                weight_data_size = get_tensor_proto_data_size(W, W.data_type)

                layer.add_param(0, hidden_size)
                layer.add_param(1, weight_data_size)
                layer.add_param(2, direction_type)

                quantize_tag = DTYPE_FP16 if is_fp16 else DTYPE_FP32
                bin_length += self.add_weight(layer, "weight", W, quantize_tag)

                # reduce xc and hc bias
                reduced_B = np.sum(onph.to_array(B), 1)
                bin_length += self.add_weight(layer, "bias", reduced_B, quantize_tag)

                bin_length += self.add_weight(layer, "R", R, quantize_tag)
            elif op == "ShuffleChannel":
                layer.add_param(0, get_node_attr_i(node, "group", 1))
                layer.add_param(1, get_node_attr_i(node, "reverse", 0))
            elif op == "Sigmoid":
                pass
            elif op == "Sin":
                layer.add_param(0, UOT.SIN)
            elif op == "SkipLayerNormalization":
                logger.error(f"No NCNN documentation for {op} yet, will not function")
                W = self.weights[node.input[2]]
                B = self.weights[node.input[3]]
                B2 = self.weights[node.input[4]]

                layer.add_param(0, get_tensor_proto_data_size(B, B.data_type))

                quantize_tag = DTYPE_FP16 if is_fp16 else DTYPE_FP32
                bin_length += self.add_weight(layer, "weight", W, quantize_tag)
                bin_length += self.add_weight(layer, "bias1", B, DTYPE_FP32)
                bin_length += self.add_weight(layer, "bias2", B2, DTYPE_FP32)
            elif op == "Slice":
                input_size = len(node.input)
                if input_size == 1:
                    starts = get_node_attr_ai(node, "starts")
                    ends = get_node_attr_ai(node, "ends")
                    axes = get_node_attr_ai(node, "axes")
                    steps = get_node_attr_ai(node, "steps")
                else:
                    starts = get_node_attr_from_input_ai(self.weights[node.input[1]])
                    ends = get_node_attr_from_input_ai(self.weights[node.input[2]])
                    if input_size >= 4:
                        axes = get_node_attr_from_input_ai(self.weights[node.input[3]])
                    else:
                        axes = np.empty(0, np.int32)
                    if input_size >= 5:
                        steps = get_node_attr_from_input_ai(self.weights[node.input[4]])
                    else:
                        steps = np.empty(0, np.int32)

                assert np.all(steps != 1), f"Unsupported Slice step {steps}"

                # Filter out N-dim axis
                if axes.size:
                    for i, axis in enumerate(axes):
                        if axis == 0:
                            np.delete(starts, i)
                            np.delete(ends, i)
                            np.delete(axes, i)
                            break

                layer.add_param(9, [starts.size, *list(starts)])
                layer.add_param(10, [ends.size, *list(ends)])
                if axes.size:
                    assert np.all(
                        axes != 0 and axes <= 3 and axes >= -3
                    ), f"Unsupported Slice axes {axes}"
                    layer.add_param(
                        11, [axes.size, *[a - 1 if a > 0 else a for a in axes]]
                    )
            elif op == "Softmax":
                axis = get_node_attr_i(node, "axis", 1)
                layer.add_param(0, axis - 1)
                layer.add_param(1, 1)
            elif op == "Split":
                axis = get_node_attr_i(node, "axis", 0)
                splits = get_node_attr_ai(node, "split")

                assert axis >= 1, f"Unsupported axis {axis} in Split"

                if splits.size:
                    layer.add_param(0, [output_size, *list(splits[:-1]), -233])
                else:
                    layer.add_param(
                        0, [output_size, *[-233 for _ in range(output_size)]]
                    )
                layer.add_param(1, axis - 1)
            elif op == "Sqrt":
                layer.add_param(0, UOT.SQRT)
            elif op == "Squeeze":
                axes = get_node_attr_ai(node, "axes")

                if axes.size:
                    assert np.all(
                        axes != 0 and axes <= 4 and axes >= -3
                    ), f"Unsupported Squeeze axes {axes}"

                    layer.add_param(
                        3, [axes.size, *[a - 1 if a > 0 else a for a in axes]]
                    )
                else:
                    layer.add_param(0, 1)
                    layer.add_param(1, 1)
                    layer.add_param(2, 1)
            elif op == "Sum":
                layer.add_param(0, EOT.SUM)
            elif op == "Swish":
                pass
            elif op == "Tan":
                layer.add_param(0, UOT.TAN)
            elif op == "Tanh":
                layer.add_param(0, UOT.TANH)
            elif op == "Transpose":
                perm = get_node_attr_ai(node, "perm")
                if perm.size == 3:
                    if (perm[1] == 1 and perm[2] == 2) or (
                        perm[0] == 1 and perm[1] == 0 and perm[2] == 2
                    ):
                        layer.add_param(0, POT.WH_WHC_WHDC)
                    elif (perm[1] == 2 and perm[2] == 1) or (
                        perm[0] == 2 and perm[1] == 0 and perm[2] == 1
                    ):
                        layer.add_param(0, POT.HW_HWC_HWDC)
                elif perm.size == 4:
                    if perm[1] == 1 and perm[2] == 2 and perm[3] == 3:
                        layer.add_param(0, POT.WH_WHC_WHDC)
                    elif perm[1] == 1 and perm[2] == 3 and perm[3] == 2:
                        layer.add_param(0, POT.HW_HWC_HWDC)
                    elif perm[1] == 2 and perm[2] == 1 and perm[3] == 3:
                        layer.add_param(0, POT.WCH_WDHC)
                    elif perm[1] == 2 and perm[2] == 3 and perm[3] == 1:
                        layer.add_param(0, POT.CWH_DWHC)
                    elif perm[1] == 3 and perm[2] == 1 and perm[3] == 2:
                        layer.add_param(0, POT.HCW_HDWC)
                    elif perm[1] == 3 and perm[2] == 2 and perm[3] == 1:
                        layer.add_param(0, POT.CHW_DHWC)
                elif perm.size == 5:
                    if perm[1] == 1 and perm[2] == 2 and perm[3] == 3 and perm[4] == 4:
                        layer.add_param(0, POT.WH_WHC_WHDC)
                    elif (
                        perm[1] == 1 and perm[2] == 3 and perm[3] == 4 and perm[4] == 2
                    ):
                        layer.add_param(0, POT.HW_HWC_HWDC)
                    elif (
                        perm[1] == 2 and perm[2] == 1 and perm[3] == 3 and perm[4] == 4
                    ):
                        layer.add_param(0, POT.WCH_WDHC)
                    elif (
                        perm[1] == 2 and perm[2] == 3 and perm[3] == 4 and perm[4] == 1
                    ):
                        layer.add_param(0, POT.CWH_DWHC)
                    elif (
                        perm[1] == 3 and perm[2] == 4 and perm[3] == 1 and perm[4] == 2
                    ):
                        layer.add_param(0, POT.HCW_HDWC)
                    elif (
                        perm[1] == 3 and perm[2] == 4 and perm[3] == 2 and perm[4] == 1
                    ):
                        layer.add_param(0, POT.CHW_DHWC)
                    else:
                        error_msg = f"Unsupported Transpose type {perm}"
                        raise ValueError(error_msg)
            elif op == "Upsample":
                mode = get_node_attr_s(node, "mode")
                align = get_node_attr_s(node, "coordinate_transformation_mode")

                if len(node.input) == 1:
                    scales = get_node_attr_af(node, "scales")
                else:
                    scales = get_node_attr_from_input_af(self.weights[node.input[1]])

                if mode in ("bilinear", "linear"):
                    resize_type = IRT.BILINEAR
                elif mode == "trilinear":
                    raise ValueError("Upsample does not support trilinear mode")
                else:
                    resize_type = IRT.NEAREST

                if scales.size == 2:
                    h_scale = 1
                    w_scale = scales[1]
                elif scales.size == 3:
                    h_scale = scales[1]
                    w_scale = scales[2]
                elif scales.size == 4:
                    h_scale = scales[2]
                    w_scale = scales[3]

                    if scales[1] != 1:
                        error_msg = f"Unsupported Upsample scales {scales}"
                        raise ValueError(error_msg)
                else:
                    error_msg = f"Unsupported Upsample scales {scales}"
                    raise ValueError(error_msg)

                align_corner = int(align == "align_corners")

                layer.add_param(0, resize_type)
                layer.add_param(1, float(h_scale))
                layer.add_param(2, float(w_scale))
                layer.add_param(6, align_corner)
            elif op == "Unsqueeze":
                axes = get_node_attr_ai(node, "axes")

                assert (
                    np.all(axes != 0) and np.all(axes <= 4) and np.all(axes >= -4)
                ), f"Unsupported axes {axes} in Unsqueeze"

                layer.add_param(
                    3, [axes.size, *[axis - 1 if axis > 0 else axis for axis in axes]]
                )
            else:
                # NCNN TODO: op specific param
                # This is presumably to catch anything they haven't written an op for yet
                for attr in node.attribute:
                    if attr.type == 1:
                        error_msg = f"Op {op} does not exist yet; {attr.name}={attr.f}"
                    elif attr.type == 2:
                        error_msg = f"Op {op} does not exist yet; {attr.name}={attr.i}"
                    elif attr.type == 3:
                        error_msg = f"Op {op} does not exist yet; {attr.name}={attr.s}"
                    else:
                        error_msg = (
                            f"Op {op} does not exist yet; {attr.name}={attr.type}"
                        )

                    raise ValueError(error_msg)

            ncnn_model.add_layer(layer)

            for o in range(output_size):
                output_name = node.output[o]
                if output_name in self.node_reference:
                    refcount = self.node_reference[output_name]
                    if refcount > 1:
                        ncnn_model.add_layer(
                            NcnnLayer(
                                "Split",
                                f"splitncnn_{internal_split}",
                                1,
                                refcount,
                                [output_name],
                                [
                                    f"{output_name}_splitncnn_{j}"
                                    for j in range(refcount)
                                ],
                            )
                        )

                        internal_split += 1

        ncnn_model.bin_length = bin_length
        NcnnOptimizer(ncnn_model).optimize()

        return ncnn_model
