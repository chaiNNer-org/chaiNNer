from copy import deepcopy
from io import BufferedReader
import os
from typing import Dict, List, Tuple, Union

from json import load as jload
import numpy as np
from onnx import TensorProto
import onnx.numpy_helper as onph
from sanic.log import logger

param_schema_file = os.path.join(
    os.path.dirname(os.path.realpath(__file__)), "ncnn_param_schema.json"
)
with open(param_schema_file, encoding="utf-8") as schemaf:
    param_schema = jload(schemaf)

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


class CastElementTypes:
    AUTO = 0
    FLOAT32 = 1
    FLOAT16 = 2
    INT8 = 3
    BFLOAT16 = 4


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
    def __init__(self, weight: np.ndarray, quantize_tag: bytes = b""):
        self.quantize_tag = quantize_tag
        self.weight = weight

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
    ) -> None:
        self.id: str = pid
        self.name: str = name
        self.value: Union[float, int, List[Union[float, int]]] = value
        self.default: Union[float, int] = default


class NcnnParamCollection:
    def __init__(
        self,
        op: str,
        param_dict: Union[Dict[int, NcnnParam], None] = None,
    ) -> None:
        self.op: str = op
        self.param_dict: Dict[int, NcnnParam] = {} if param_dict is None else param_dict
        self.weight_order: List[str] = (
            param_schema[self.op]["weightOrder"] if self.op else []
        )

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

        self.param_dict[pid] = NcnnParam(idstr, name, value, def_val)

    def __delitem__(self, key: int) -> None:
        try:
            del self.param_dict[key]
        except KeyError:
            pass

    def __contains__(self, item) -> bool:
        if item in self.param_dict:
            return True
        return False

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

    def set_op(self, op: str) -> None:
        self.op = op
        self.weight_order = param_schema[op]["weightOrder"]


class NcnnLayer:
    def __init__(
        self,
        op_type: str = "",
        name: str = "",
        num_inputs: int = 0,
        num_outputs: int = 0,
        inputs: Union[List[str], None] = None,
        outputs: Union[List[str], None] = None,
        params: Union[NcnnParamCollection, None] = None,
        weight_data: Union[Dict[str, NcnnWeight], None] = None,
    ):
        self.op_type: str = op_type
        self.name: str = name
        self.num_inputs: int = num_inputs
        self.num_outputs: int = num_outputs
        self.inputs: List[str] = [] if inputs is None else inputs
        self.outputs: List[str] = [] if outputs is None else outputs
        self.params: NcnnParamCollection = (
            NcnnParamCollection(op_type) if params is None else params
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
    ) -> bytes:
        if isinstance(data, TensorProto):
            data_array = onph.to_array(data)
        elif isinstance(data, float):
            data_array = np.array(data, np.float32)
        elif isinstance(data, int):
            data_array = np.array(data, np.int32)
        else:
            data_array = data

        if quantize_tag == DTYPE_FP16:
            data_array = data_array.astype(np.float16)
        self.weight_data[weight_name] = NcnnWeight(data_array, quantize_tag)

        return quantize_tag + data_array.tobytes()


class NcnnModel:
    MAGIC = "7767517"

    def __init__(self, node_count: int = 0, blob_count: int = 0):
        self.node_count: int = node_count
        self.blob_count: int = blob_count
        self.layer_list: List[NcnnLayer] = []
        self.weights_bin: bytes = b""

    @staticmethod
    def stringify_list(a: List[str]) -> str:
        return "".join(i + " " for i in a)

    @staticmethod
    def interp_layers(
        a: NcnnLayer, b: NcnnLayer, alpha_a: float
    ) -> Tuple[NcnnLayer, bytes]:
        weights_a = a.weight_data
        weights_b = b.weight_data
        weights_interp: Dict[str, NcnnWeight] = {}
        layer_bytes = b""

        if weights_a:
            assert len(weights_a) == len(
                weights_b
            ), "All corresponding nodes must have same number of weights"

            layer_bytes_list = []
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
                )
                layer_bytes_list.append(
                    weight_c.quantize_tag + weight_c.weight.tobytes()
                )

                weights_interp[weight_name] = weight_c

            layer_bytes = b"".join(layer_bytes_list)

        return (
            NcnnLayer(
                a.op_type,
                a.name,
                a.num_inputs,
                a.num_outputs,
                a.inputs,
                a.outputs,
                a.params,
                weights_interp,
            ),
            layer_bytes,
        )

    def add_layer(self, layer: NcnnLayer) -> None:
        self.layer_list.append(layer)

    def parse_param_layer(self, layer_str: str) -> Tuple[str, NcnnLayer]:
        param_list = layer_str.strip().split()
        op_type, name = param_list[:2]
        assert op_type != "MemoryData", "This NCNN param file contains invalid layers"

        num_inputs = int(param_list[2])
        num_outputs = int(param_list[3])
        input_end = 4 + num_inputs
        output_end = input_end + num_outputs
        inputs = [i for i in param_list[4:input_end]]
        outputs = [o for o in param_list[input_end:output_end]]

        params = param_list[output_end:]
        param_dict = {}
        for param_str in params:
            ks, vs = param_str.split("=")
            k = int(ks)
            if k < 0:
                v = []
                for vi in vs.split(","):
                    vi = float(vi) if "." in vi or "e" in vi else int(vi)
                    v.append(vi)
                k = abs(k + 23300)
                ks = str(k)
            elif "." in vs or "e" in vs:
                v = float(vs)
            else:
                v = int(vs)

            param = NcnnParam(
                ks,
                param_schema[op_type][ks]["paramPhase"],
                v,
                param_schema[op_type][ks]["defaultValue"],
            )
            param_dict[k] = param

        return op_type, NcnnLayer(
            op_type,
            name,
            num_inputs,
            num_outputs,
            inputs,
            outputs,
            NcnnParamCollection(op_type, param_dict),
        )

    def load_layer_weights(
        self, binf: BufferedReader, op_type: str, layer: NcnnLayer
    ) -> Dict[str, NcnnWeight]:
        weight_dict = {}
        if op_type == "Convolution":
            quantize_tag = binf.read(4)
            dtype = np.float16 if quantize_tag == DTYPE_FP16 else np.float32
            weight_data_length = layer.params[6].value
            assert isinstance(weight_data_length, int), "Data size must be int"
            weight_data_size = (
                weight_data_length * 2
                if quantize_tag == DTYPE_FP16
                else weight_data_length * 4
            )

            has_bias = layer.params[5].value if 5 in layer.params else 0

            num_filters = layer.params[0].value
            kernel_w = layer.params[1].value
            kernel_h = layer.params[11].value if 11 in layer.params else kernel_w
            num_input = weight_data_length // num_filters // kernel_w // kernel_h  # type: ignore
            shape = (num_filters, num_input, kernel_w, kernel_h)

            weight_data = np.frombuffer(binf.read(weight_data_size), dtype)
            weight_data = weight_data.reshape(shape)  # type: ignore
            weight_dict["weight"] = NcnnWeight(weight_data, quantize_tag)

            if has_bias:
                bias_data_size = num_filters * 4
                bias_data = np.frombuffer(binf.read(bias_data_size), np.float32)  # type: ignore
                weight_dict["bias"] = NcnnWeight(bias_data)

        return weight_dict

    def load_model(self, param_path: str, bin_path: Union[str, None] = None) -> None:
        if bin_path is None:
            bin_path = param_path.replace(".param", ".bin")

        assert os.path.exists(param_path), f"{param_path} does not exist"
        assert os.path.exists(bin_path), f"{bin_path} does not exist"

        with open(param_path, "r", encoding="utf-8") as paramf:
            with open(bin_path, "rb") as binf:
                paramf.readline()
                counts = paramf.readline().strip().split(" ")
                self.node_count = int(counts[0])
                self.blob_count = int(counts[1])

                for line in paramf:
                    op_type, layer = self.parse_param_layer(line)
                    layer.weight_data = self.load_layer_weights(binf, op_type, layer)
                    self.add_layer(layer)

    def write_param(self, filename: str) -> None:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(f"{self.MAGIC}\n")
            f.write(f"{self.node_count} {self.blob_count}\n")

            for layer in self.layer_list:
                layer_str = (
                    f"{layer.op_type:<16} "
                    f"{layer.name:<24} "
                    f"{layer.num_inputs} "
                    f"{layer.num_outputs} "
                    f"{self.stringify_list(layer.inputs)}"
                    f"{self.stringify_list(layer.outputs)}"
                    f"{str(layer.params)}".rstrip()
                )
                f.write(layer_str + "\n")

    def write_param_to_mem(self) -> str:
        param_str = f"{self.MAGIC}\n{self.node_count} {self.blob_count}\n"
        for layer in self.layer_list:
            layer_str = (
                f"{layer.op_type:<16} "
                f"{layer.name:<24} "
                f"{layer.num_inputs} "
                f"{layer.num_outputs} "
                f"{self.stringify_list(layer.inputs)}"
                f"{self.stringify_list(layer.outputs)}"
                f"{str(layer.params)}".rstrip()
            )
            param_str += layer_str + "\n"

        return param_str

    def write_bin(self, filename: str) -> None:
        with open(filename, "wb") as f:
            f.write(self.weights_bin)

    def interpolate_ncnn(self, model_b, alpha):
        interp_model = deepcopy(self)
        interp_model.weights_bin = b""

        layer_a_weights = [
            (i, l) for i, l in enumerate(self.layer_list) if l.weight_data
        ]
        layer_b_weights = [
            (i, l) for i, l in enumerate(model_b.layer_list) if l.weight_data
        ]

        assert len(layer_a_weights) == len(
            layer_b_weights
        ), "Models must have same number of layers containing weights"

        weight_bytes_list = []
        for layer_a, layer_b in zip(layer_a_weights, layer_b_weights):
            interp_layer, layer_bytes = NcnnModel.interp_layers(
                layer_a[1], layer_b[1], alpha
            )
            interp_model.layer_list[layer_a[0]] = interp_layer
            weight_bytes_list.append(layer_bytes)

        interp_model.weights_bin = b"".join(weight_bytes_list)

        return interp_model
