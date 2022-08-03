from copy import deepcopy
import os
from typing import Dict, List, Union

from json import load as jload
from typing_extensions import Self
from weakref import KeyedRef
import numpy as np
from onnx import TensorProto
import onnx.numpy_helper as onph
from sanic.log import logger

param_schema_file = os.path.join(
    os.path.dirname(os.path.realpath(__file__)), "ncnn_param_schema_converted.json"
)
with open(param_schema_file) as f:
    param_schema = jload(f)

DTYPE_FP32 = b"\x00\x00\x00\x00"
DTYPE_FP16 = b"\x47\x6b\x30\x01"


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


class GruDirectionFlags:
    FORWARD = 0
    REVERSE = 1
    BIDIRECTIONAL = 2


class InterpResizeTypes:
    NEAREST = 1
    BILINEAR = 2
    BICUBIC = 3


class NormalizeEpsModes:
    CAFFE = 0
    PYTORCH = 1
    TENSORFLOW = 2


class PaddingTypes:
    CONSTANT = 0
    REPLICATE = 1
    REFLECT = 2


class PadModes:
    FULL = 0
    VALID = 1
    SAMEUPPER = 2
    SAMELOWER = 3


class PermuteOrderTypes:
    WH_WHC_WHDC = 0
    HW_HWC_HWDC = 1
    WCH_WDHC = 2
    CWH_DWHC = 3
    HCW_HDWC = 4
    CHW_DHWC = 5
    WHCD = 6
    HWCD = 7
    WCHD = 8
    CWHD = 9
    HCWD = 10
    CHWD = 11
    WDCH = 12
    DWCH = 13
    WCDH = 14
    CWDH = 15
    DCWH = 16
    CDWH = 17
    HDCW = 18
    DHCW = 19
    HCDW = 20
    CHDW = 21
    DCHW = 22
    CDHW = 23


class ReductionOpTypes:
    SUM = 0
    ASUM = 1
    SUMSQ = 2
    MEAN = 3
    MAX = 4
    MIN = 5
    PROD = 6
    L1 = 7
    L2 = 8
    LOGSUM = 9
    LOGSUMEXP = 10


class NcnnWeight:
    def __init__(
        self, weight: np.ndarray, quantize_tag: bytes = b"", can_be_fp16: bool = False
    ):
        self.quantize_tag = quantize_tag
        self.weight = weight
        self.can_be_fp16 = can_be_fp16

    @property
    def size(self) -> int:
        return self.weight.size


class NcnnParam:
    def __init__(
        self,
        pid: str,
        name: str,
        value: Union[float, int, List[Union[float, int]]],
        default: Union[float, int],
        weight_order: str = "",
    ) -> None:
        self.id: str = pid
        self.name: str = name
        self.value: Union[float, int, List[Union[float, int]]] = value
        self.default: Union[float, int] = default
        self.weight_order = weight_order


class NcnnParamCollection(Dict):
    def __init__(self, op: str) -> None:
        self.op: str = op
        self.param_dict: Dict[int, NcnnParam] = {}

    def __getitem__(self, key: int) -> NcnnParam:
        return self.param_dict[key]

    def __setitem__(
        self, pid: int, value: Union[float, int, List[Union[float, int]]]
    ) -> None:
        idstr = str(pid)
        param_dict = param_schema[self.op]
        param = param_dict[idstr]
        name = param["paramPhase"]
        def_val = param["defaultValue"]
        weight_order = param["weightOrder"]

        self.param_dict[pid] = NcnnParam(idstr, name, value, def_val, weight_order)

    def __delitem__(self, key: int) -> None:
        try:
            del self.param_dict[key]
        except KeyError:
            pass

    def __str__(self) -> str:
        output = ""
        for v in self.param_dict.values():
            if isinstance(v.value, list):
                output += "-233" + v.id.zfill(2) + "="
            else:
                output += v.id + "="

            if isinstance(v.value, float) or (isinstance(v.value, np.float32)):  # type: ignore
                v_str = np.format_float_scientific(v.value, 6, False, exp_digits=2)
            elif isinstance(v.value, list):
                v_str = ",".join([str(n) for n in v.value])
            else:
                v_str = str(v.value)

            output += v_str + " "

        return output


class NcnnLayer:
    def __init__(
        self,
        type: str = "",
        name: str = "",
        num_inputs: int = 0,
        num_outputs: int = 0,
        inputs: Union[List[str], None] = None,
        outputs: Union[List[str], None] = None,
        params: Union[NcnnParamCollection, None] = None,
        weight_data: Union[Dict[str, NcnnWeight], None] = None,
    ):
        self.type: str = type
        self.name: str = name
        self.num_inputs: int = num_inputs
        self.num_outputs: int = num_outputs
        self.inputs: List[str] = [] if inputs is None else inputs
        self.outputs: List[str] = [] if outputs is None else outputs
        self.params: NcnnParamCollection = (
            NcnnParamCollection(type) if params is None else params
        )
        self.weight_data: Dict[str, NcnnWeight] = (
            {} if weight_data is None else weight_data
        )

    def add_param(
        self, pid: int, value: Union[float, int, List[Union[float, int]]]
    ) -> None:
        self.params[pid] = value

    def add_weight(
        self,
        data: Union[float, int, np.ndarray, TensorProto],
        weight_name: str,
        quantize_tag: bytes = b"",
        can_be_fp16: bool = False,
        is_fp16: bool = False,
    ) -> None:
        if isinstance(data, TensorProto):
            data = onph.to_array(data)
        elif isinstance(data, float):
            data = np.array(data, np.float32)
        elif isinstance(data, int):
            data = np.array(data, np.int32)

        if is_fp16:
            data = data.astype(np.float16)
        self.weight_data[weight_name] = NcnnWeight(data, quantize_tag, can_be_fp16)


class NcnnModel:
    MAGIC = "7767517"

    def __init__(self, node_count: int = 0, blob_count: int = 0):
        self.node_count: int = node_count
        self.blob_count: int = blob_count
        self.layer_list: List[NcnnLayer] = []

    @staticmethod
    def stringify_list(a: List[str]) -> str:
        return "".join(i + " " for i in a)

    @staticmethod
    def interp_layers(a: NcnnLayer, b: NcnnLayer, alpha_a: float) -> NcnnLayer:
        weights_a = a.weight_data
        weights_b = b.weight_data
        weights_interp: Dict[str, NcnnWeight] = {}

        if weights_a:
            assert len(weights_a) == len(
                weights_b
            ), "All corresponding nodes must have same number of weights"

            for weight_name, weight_a in weights_a.items():
                try:
                    weight_b = weights_b[weight_name]
                except KeyError as e:
                    logger.error(
                        f"Weights in node {a.name} and {b.name} do not correspond"
                    )
                    raise e

                assert (
                    weight_a.size == weight_b.size
                ), "Corresponding weights must have the same size"

                assert len(weight_a.quantize_tag) == len(
                    weight_b.quantize_tag
                ), "Weights must either both have or both not have a quantize tag"

                if (
                    weight_a.quantize_tag == DTYPE_FP16
                    and weight_b.quantize_tag == DTYPE_FP32
                ):
                    weight_b.quantize_tag = DTYPE_FP16
                    weight_b.weight = weight_b.weight.astype(np.float16)
                elif (
                    weight_a.quantize_tag == DTYPE_FP32
                    and weight_b.quantize_tag == DTYPE_FP16
                ):
                    weight_a.quantize_tag = DTYPE_FP16
                    weight_a.weight = weight_a.weight.astype(np.float16)

                weight_c = NcnnWeight(
                    (weight_a.weight * alpha_a + weight_b.weight * (1 - alpha_a)),
                    weight_a.quantize_tag,
                    weight_a.can_be_fp16,
                )

                weights_interp[weight_name] = weight_c

        return NcnnLayer(
            a.type,
            a.name,
            a.num_inputs,
            a.num_outputs,
            a.inputs,
            a.outputs,
            a.params,
            weights_interp,
        )

    def add_layer(self, layer: NcnnLayer) -> None:
        self.layer_list.append(layer)

    def write_param(self, filename: str) -> None:
        with open(filename, "w") as f:
            f.write(f"{self.MAGIC}\n")
            f.write(f"{self.node_count} {self.blob_count}\n")

            for layer in self.layer_list:
                layer_str = (
                    f"{layer.type:<16} "
                    f"{layer.name:<24} "
                    f"{layer.num_inputs} "
                    f"{layer.num_outputs} "
                    f"{self.stringify_list(layer.inputs)}"
                    f"{self.stringify_list(layer.outputs)}"
                    f"{str(layer.params)}".rstrip()
                )
                f.write(layer_str + "\n")

    def write_bin(self, filename: str) -> None:
        with open(filename, "wb") as f:
            for layer in self.layer_list:
                for w in layer.weight_data.values():
                    if w.quantize_tag:
                        f.write(w.quantize_tag)
                    f.write(w.weight.tobytes())


def interpolate_ncnn(model_a: NcnnModel, model_b: NcnnModel, alpha: float) -> NcnnModel:
    interp_model = NcnnModel(model_a.node_count, model_a.blob_count)

    for layer_a, layer_b in zip(model_a.layer_list, model_b.layer_list):
        interp_model.add_layer(NcnnModel.interp_layers(layer_a, layer_b, alpha))

    return interp_model
