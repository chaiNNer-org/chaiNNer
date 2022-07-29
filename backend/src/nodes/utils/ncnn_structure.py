from typing import Dict, List, Union

import numpy as np


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
        inputs: Union[List[str], None] = None,
        outputs: Union[List[str], None] = None,
        params: Union[Dict[int, Union[float, int]], None] = None,
        quantize_tag: bytes = b"",
        weight_data: bytes = b"",
        bias_data: bytes = b"",
    ):
        self.layer_type: str = layer_type
        self.layer_name: str = layer_name
        self.num_inputs: int = num_inputs
        self.num_outputs: int = num_outputs
        self.inputs: List[str] = [] if inputs is None else inputs
        self.outputs: List[str] = [] if outputs is None else outputs
        self.params: Dict[int, Union[float, int]] = {} if params is None else params
        self.quantize_tag: bytes = quantize_tag
        self.weight_data: bytes = weight_data
        self.bias_data: bytes = bias_data


class NcnnModel:
    MAGIC = "7767517"

    def __init__(self):
        self.node_count: int = 0
        self.blob_count: int = 0
        self.layer_list: List[NcnnLayer] = []

    @staticmethod
    def unpack_dict(a: Dict[int, Union[float, int]]) -> str:
        b = {}
        for k, v in a.items():
            if isinstance(v, float) or (isinstance(v, np.float32)):
                v = np.format_float_scientific(v, 6, False, exp_digits=2)
            else:
                v = str(v)

            b[str(k)] = v

        return "".join(f"{k}={v} " for k, v in b.items())

    @staticmethod
    def unpack_list(a: List[str]) -> str:
        return "".join(i + " " for i in a)

    def add_layer(self, layer: NcnnLayer) -> None:
        self.layer_list.append(layer)

    def write_param(self, filename: str) -> None:
        with open(filename, "w") as f:
            f.write(f"{self.MAGIC}\n")
            f.write(f"{self.node_count} {self.blob_count}\n")

            for layer in self.layer_list:
                f.write(
                    f"{layer.layer_type:<16} {layer.layer_name:<24} {layer.num_inputs} {layer.num_outputs} {self.unpack_list(layer.inputs)}{self.unpack_list(layer.outputs)}{self.unpack_dict(layer.params)}".rstrip()
                )
                f.write("\n")

    def write_bin(self, filename: str) -> None:
        with open(filename, "wb") as f:
            for layer in self.layer_list:
                if layer.bias_data != b"":
                    print(f"{layer.layer_name}: {layer.bias_data}")
                if layer.quantize_tag != b"":
                    f.write(layer.quantize_tag)
                    f.write(layer.weight_data)
                    f.write(layer.bias_data)
                    f.flush()
