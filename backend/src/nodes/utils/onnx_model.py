# This class defines an interface.
# It is important that is does not contain types that depend on ONNX.
from typing import List, Tuple, Union

from sanic.log import logger


class OnnxModel:
    def __init__(self, model_as_bytes: bytes):
        self.model: bytes = model_as_bytes
        scale, in_nc, out_nc, nf = self.get_broadcast_data()
        self.scale: Union[int, None] = scale
        self.in_nc = in_nc
        self.out_nc = out_nc
        self.nf = nf

    def get_broadcast_data(self) -> List[Union[int, None]]:
        try:
            import onnx
            from .onnx_tensor_utils import get_node_attr_from_input_af

            graph = onnx.load_model_from_string(self.model).graph
            weights = {
                initializer.name: initializer for initializer in graph.initializer
            }

            scale = 1
            in_nc = 0
            out_nc = 0
            nf = 0
            pixel_shuffle = 1
            found_first_conv = False
            current_conv = None
            for i, node in enumerate(graph.node):
                if node.op_type == "Resize" or node.op_type == "Upsample":
                    try:
                        if graph.node[i + 1].op_type != "Add":
                            scales = get_node_attr_from_input_af(weights[node.input[2]])

                            if scales.size == 2:
                                resize_scale = scales[1]
                            elif scales.size == 3:
                                resize_scale = scales[2]
                            elif scales.size == 4:
                                resize_scale = scales[3]
                            else:
                                resize_scale = 1

                            scale *= resize_scale
                    except IndexError:
                        pass

            return [scale, *(None,) * 3]

        except ImportError:
            return [None, None, None, None]
