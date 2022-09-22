# This class defines an interface.
# It is important that is does not contain types that depend on ONNX.
from typing import Tuple

from sanic.log import logger


class OnnxModel:
    def __init__(self, model_as_bytes: bytes):
        self.model: bytes = model_as_bytes
        scale, in_nc, out_nc, nf = self.get_broadcast_data()
        self.scale: int = scale
        self.in_nc: int = in_nc
        self.out_nc: int = out_nc
        self.nf: int = nf

    def get_broadcast_data(self) -> Tuple[int, int, int, int]:
        try:
            import onnx
            import onnxoptimizer as onop

            from .onnx_tensor_utils import (
                get_node_attr_ai,
                get_node_attr_from_input_af,
                get_node_attr_from_input_ai,
                get_node_attr_i,
                get_node_attr_tensor,
                get_tensor_proto_data_size,
            )

            model = onnx.load_model_from_string(self.model)
            passes = onop.get_fuse_and_elimination_passes()
            graph = onop.optimize(model, passes).graph
            weights = {
                initializer.name: initializer for initializer in graph.initializer
            }

            scale = 1
            in_nc = 1
            out_nc = 1
            nf = 1
            pixel_shuffle = 1
            found_first_conv = False
            current_conv = None
            for i, node in enumerate(graph.node):
                op = node.op_type
                if op == "Constant":
                    weights[node.output[0]] = get_node_attr_tensor(node, "value")
                elif op == "Resize" or op == "Upsample":
                    try:
                        if graph.node[i + 1].op_type != "Add":
                            if len(node.input) == 2:
                                scales = get_node_attr_from_input_af(
                                    weights[node.input[1]]
                                )
                            else:
                                scales = get_node_attr_from_input_af(
                                    weights[node.input[2]]
                                )

                            if scales.size == 2:
                                resize_scale = int(scales[1])
                            elif scales.size == 3:
                                resize_scale = int(scales[2])
                            elif scales.size == 4:
                                resize_scale = int(scales[3])
                            else:
                                resize_scale = 1

                            scale *= resize_scale
                    except IndexError:
                        continue
                elif op == "Reshape":
                    try:
                        if graph.node[i + 1].op_type == "Transpose" and (
                            graph.node[i + 2].op_type == "Reshape"
                            or (
                                graph.node[i + 2].op_type == "Constant"
                                and graph.node[i + 3].op_type == "Reshape"
                            )
                        ):
                            if len(node.input) == 1:
                                shape = get_node_attr_ai(node, "shape")
                            else:
                                if node.input[1] not in weights:
                                    continue
                                shape = get_node_attr_from_input_ai(
                                    weights[node.input[1]]
                                )

                            scale *= int(shape[2])
                            pixel_shuffle *= int(shape[2])
                    except IndexError:
                        continue
                elif op == "DepthToSpace":
                    scale_factor = get_node_attr_i(node, "blocksize", 1)
                    scale *= scale_factor
                    pixel_shuffle *= scale_factor
                elif op == "Conv":
                    if found_first_conv is not True:
                        weight_data_size = get_tensor_proto_data_size(
                            weights[node.input[1]]
                        )
                        nf = weights[node.input[1]].dims[0]
                        kernel_size = get_node_attr_ai(node, "kernel_shape")
                        in_nc = (
                            weight_data_size
                            // nf
                            // int(kernel_size[0])
                            // int(kernel_size[1])
                        )
                        found_first_conv = True

                    scale //= int(get_node_attr_ai(node, "strides")[0])
                    current_conv = node
                elif op == "ConvTranspose":
                    scale *= int(get_node_attr_ai(node, "strides")[0])

            try:
                out_nc = weights[current_conv.input[1]].dims[0] // pixel_shuffle**2  # type: ignore
            except AttributeError:
                raise AttributeError("Model has no convolution layers")

            return scale, in_nc, out_nc, nf

        except ImportError:
            return 1, 1, 1, 1
