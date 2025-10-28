from __future__ import annotations

from typing import Any, Literal

import onnx
from onnx.onnx_pb import ModelProto, ValueInfoProto

from .update_model_dims import update_inputs_outputs_dims

OnnxTensorFormat = Literal["BCHW", "BHWC"]
OnnxTensorShape = tuple[
    int | str,
    int | str,
    int | str,
    int | str,
]
OnnxParsedTensorShape = tuple[
    OnnxTensorFormat,
    int,
    int | None,
    int | None,
]
"""
The elements are:
- The tensor format (BCHW or BHWC).
- The number of channels.
- The width (optional).
- The height (optional).
"""


def _as_int(value: object) -> int | None:
    if isinstance(value, int):
        return value
    return None


def _or_else(value: int | None, default: int) -> int:
    return value if value is not None else default


def parse_onnx_shape(shape: OnnxTensorShape) -> OnnxParsedTensorShape:
    if isinstance(shape[1], int) and shape[1] <= 4:
        return "BCHW", shape[1], _as_int(shape[3]), _as_int(shape[2])
    elif isinstance(shape[3], int) and shape[3] <= 4:
        return "BHWC", shape[3], _as_int(shape[2]), _as_int(shape[1])
    else:
        return "BCHW", 3, _as_int(shape[3]), _as_int(shape[2])


def to_onnx_tensor_shape(
    tensor: onnx.TypeProto.Tensor,
) -> OnnxTensorShape:
    shape = tuple(
        dim.dim_param if dim.HasField("dim_param") else dim.dim_value
        for dim in tensor.shape.dim
    )
    if len(shape) != 4:
        raise ValueError(f"Expected 4 dimensions, got {len(shape)}")
    return shape


def is_tensor_input(input: ValueInfoProto) -> bool:
    return input.type.HasField("tensor_type")


def is_image_to_image(model: ModelProto) -> bool:
    """
    Returns whether the model is an image to image model (single image input -> single image output).
    """
    if len(model.graph.input) != 1 or len(model.graph.output) != 1:
        return False

    i = model.graph.input[0]
    o = model.graph.output[0]
    return is_tensor_input(i) and is_tensor_input(o)


class ModelShapeInference:
    def __init__(self, model: ModelProto):
        self.model = model

        i = model.graph.input[0]
        o = model.graph.output[0]

        if not is_tensor_input(i) or not is_tensor_input(o):
            raise ValueError("Expected tensor inputs and outputs")

        # modify model to have a fixed input size
        self.input_shape = to_onnx_tensor_shape(i.type.tensor_type)
        self.output_shape = to_onnx_tensor_shape(o.type.tensor_type)

        parsed_input_shape = parse_onnx_shape(self.input_shape)
        self.tensor_format = parsed_input_shape[0]
        self.input_channels = parsed_input_shape[1]
        self.fixed_input_width = parsed_input_shape[2]
        self.fixed_input_height = parsed_input_shape[3]

        self.output_channels = _as_int(
            self.output_shape[1]
            if self.tensor_format == "BCHW"
            else self.output_shape[3]
        )

    def infer_shape(
        self, input_size: tuple[int, int]
    ) -> tuple[
        tuple[int | None, int | None, int | None],
        tuple[int | None, int | None, int | None],
    ]:
        """
        input_shape: The size of the input tensors as width, height.

        return: The shapes of the input and output tensors in HWC format.

        **This will mutate the model.**
        """
        b = _or_else(_as_int(self.input_shape[0]), 1)
        c = self.input_channels
        h = _or_else(self.fixed_input_height, input_size[1])
        w = _or_else(self.fixed_input_width, input_size[0])

        new_inputs: list[Any]
        if self.tensor_format == "BCHW":
            new_inputs = [b, c, h, w]
        elif self.tensor_format == "BHWC":
            new_inputs = [b, h, w, c]
        else:
            raise ValueError(f"Unknown tensor format: {self.tensor_format}")

        i = self.model.graph.input[0]
        o = self.model.graph.output[0]

        update_inputs_outputs_dims(
            self.model,
            {i.name: new_inputs},
            {o.name: list(self.output_shape)},
        )

        # infer the output shape using the fixed input size
        inferred_model = onnx.shape_inference.infer_shapes(self.model, strict_mode=True)
        i = inferred_model.graph.input[0]
        o = inferred_model.graph.output[0]

        input_shape = to_onnx_tensor_shape(i.type.tensor_type)
        output_shape = to_onnx_tensor_shape(o.type.tensor_type)

        # output in HWC format
        input_shape = input_shape[1:]
        output_shape = output_shape[1:]

        if self.tensor_format == "BCHW":
            input_shape = input_shape[::-1]
            output_shape = output_shape[::-1]

        input_shape = tuple(_as_int(dim) for dim in input_shape)
        output_shape = tuple(_as_int(dim) for dim in output_shape)

        assert len(input_shape) == 3
        assert len(output_shape) == 3

        return input_shape[0:3], output_shape


def get_tensor_fp_datatype(model: ModelProto) -> str:
    for item in [*model.graph.input, *model.graph.output]:
        if item.type.HasField("tensor_type"):
            tensor = item.type.tensor_type
            if tensor.elem_type == onnx.TensorProto.FLOAT16:
                return "fp16"
            if tensor.elem_type == onnx.TensorProto.FLOAT:
                return "fp32"
            if tensor.elem_type == onnx.TensorProto.DOUBLE:
                return "fp64"
            if tensor.elem_type == onnx.TensorProto.BFLOAT16:
                return "bf16"
    return "fp32"


def get_opset(model: onnx.ModelProto) -> int:
    for opset in model.opset_import:
        if opset.domain == "":
            return opset.version
    return -1


def safely_optimize_onnx_model(model_proto: ModelProto) -> ModelProto:
    """
    Optimizes the model using onnxoptimizer. If onnxoptimizer is not installed, the model is returned as is.
    """
    try:
        import onnxoptimizer

        passes = onnxoptimizer.get_fuse_and_elimination_passes()
        model_proto = onnxoptimizer.optimize(model_proto, passes)
    except Exception:
        pass
    return model_proto
