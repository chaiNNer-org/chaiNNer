from typing import Dict, List, Union


class UnaryOpTypes:
    ABS = 0
    NEG = 1
    FLOOR = 2
    CEIL = 3
    SQUARE = 4
    SQRT = 5
    RSQ = 6
    EXP = 7
    LOG = 8
    SIN = 9
    COS = 10
    TAN = 11
    ASIN = 12
    ACOS = 13
    ATAN = 14
    RECIPROCAL = 15
    TANH = 16


class BinaryOpTypes:
    ADD = 0
    SUB = 1
    MUL = 2
    DIV = 3
    MAX = 4
    MIN = 5
    POW = 6
    RSUB = 7
    RDIV = 8


class EltwiseOpTypes:
    PROD = 0
    SUM = 1
    MAX = 2


class NcnnLayer:
    def __init__(
        self,
        layer_type: str = "",
        layer_name: str = "",
        num_inputs: int = 0,
        num_outputs: int = 0,
        inputs: List[str] = [],
        outputs: List[str] = [],
        params: Dict[int, Union[float, int]] = {},
        quantize_tag: bytes = b"",
        weight_data: bytes = b"",
        bias_data: bytes = b"",
    ):
        self.layer_type: str = layer_type
        self.layer_name: str = layer_name
        self.num_inputs: int = num_inputs
        self.num_outputs: int = num_outputs
        self.inputs: List[str] = inputs
        self.outputs: List[str] = outputs
        self.params: Dict[int, Union[float, int]] = params
        self.quantize_tag: bytes = quantize_tag
        self.weight_data: bytes = weight_data
        self.bias_data: bytes = bias_data


class NcnnModel:
    MAGIC = "7767517"

    def __init__(self):
        self.node_count: int = 0
        self.blob_count: int = 0
        self.layer_list: List[NcnnLayer] = []

    def add_layer(self, layer: NcnnLayer) -> None:
        self.layer_list.append(layer)
