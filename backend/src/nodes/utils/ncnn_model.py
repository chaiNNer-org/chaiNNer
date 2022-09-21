import os
from copy import deepcopy
from io import BufferedReader, StringIO
from json import load as jload
from typing import Dict, List, Tuple, Union

import numpy as np
from sanic.log import logger

# Don't want not having onnx to crash this
try:
    import onnx.numpy_helper as onph
    from onnx import TensorProto
except:
    TensorProto = None
    onph = None

param_schema_file = os.path.join(
    os.path.dirname(os.path.realpath(__file__)), "ncnn_param_schema.json"
)
with open(param_schema_file, encoding="utf-8") as schemaf:
    param_schema = jload(schemaf)

DTYPE_FP32 = b"\x00\x00\x00\x00"
DTYPE_FP16 = b"\x47\x6b\x30\x01"
DTYPE_DICT = {b"\x00\x00\x00\x00": np.float32, b"\x47\x6b\x30\x01": np.float16}


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
    def shape(self) -> tuple:
        return self.weight.shape


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
        try:
            return self.param_dict[key]
        except KeyError:
            logger.error(f"Op {self.op} does not have param {key}")
            raise

    def __setitem__(
        self, pid: int, value: Union[float, int, List[Union[float, int]]]
    ) -> None:
        idstr = str(pid)
        param_dict = param_schema[self.op]
        try:
            param = param_dict[idstr]
        except KeyError:
            logger.error(f"Op {self.op} does not have param {idstr}, please report")
            raise
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
        data: Union[float, int, np.ndarray, TensorProto],  # type: ignore
        weight_name: str,
        quantize_tag: bytes = b"",
    ) -> bytes:
        if isinstance(data, TensorProto):  # type: ignore
            data_array = onph.to_array(data)  # type: ignore
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
    def __init__(
        self,
        node_count: int = 0,
        blob_count: int = 0,
    ) -> None:
        self.node_count: int = node_count
        self.blob_count: int = blob_count
        self.layer_list: List[NcnnLayer] = []
        self.weights_bin: bytes = b""

    @property
    def magic(self):
        return "7767517"

    @staticmethod
    def load_from_file(param_path: str = "", bin_path: str = "") -> "NcnnModel":
        if bin_path == "":
            bin_path = param_path.replace(".param", ".bin")
        elif param_path == "":
            param_path = bin_path.replace(".bin", ".param")

        model = NcnnModel()
        with open(param_path, "r", encoding="utf-8") as paramf:
            with open(bin_path, "rb") as binf:
                paramf.readline()
                counts = paramf.readline().strip().split(" ")
                model.node_count = int(counts[0])
                model.blob_count = int(counts[1])

                for line in paramf:
                    op_type, layer = model.parse_param_layer(line)
                    layer.weight_data = model.load_layer_weights(binf, op_type, layer)
                    model.add_layer(layer)

                binf.seek(0)
                model.weights_bin = binf.read()

        return model

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
                except KeyError:
                    logger.error(
                        f"Weights in node {a.name} and {b.name} do not correspond"
                    )
                    raise

                assert (
                    weight_a.shape == weight_b.shape
                ), "Corresponding weights must have the same size and shape"

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
            dtype = DTYPE_DICT[quantize_tag]
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
            shape = (num_filters, num_input, kernel_h, kernel_w)

            weight_data = np.frombuffer(binf.read(weight_data_size), dtype)
            weight_data = weight_data.reshape(shape)  # type: ignore
            weight_dict["weight"] = NcnnWeight(weight_data, quantize_tag)

            if has_bias:
                bias_data_size = num_filters * 4
                bias_data = np.frombuffer(binf.read(bias_data_size), np.float32)  # type: ignore
                weight_dict["bias"] = NcnnWeight(bias_data)
        elif op_type == "Deconvolution":
            quantize_tag = binf.read(4)
            dtype = DTYPE_DICT[quantize_tag]
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
            shape = (num_filters, num_input, kernel_h, kernel_w)

            weight_data = np.frombuffer(binf.read(weight_data_size), dtype)
            weight_data = weight_data.reshape(shape)  # type: ignore
            weight_dict["weight"] = NcnnWeight(weight_data, quantize_tag)

            if has_bias:
                bias_data_size = num_filters * 4
                bias_data = np.frombuffer(binf.read(bias_data_size), np.float32)  # type: ignore
                weight_dict["bias"] = NcnnWeight(bias_data)
        elif op_type == "InnerProduct":
            quantize_tag = binf.read(4)
            dtype = DTYPE_DICT[quantize_tag]
            weight_data_length = layer.params[2].value
            assert isinstance(weight_data_length, int), "Weight data size must be int"
            weight_data_size = (
                weight_data_length * 2
                if quantize_tag == DTYPE_FP16
                else weight_data_length * 4
            )
            weight_data = np.frombuffer(binf.read(weight_data_size), dtype)
            num_output = layer.params[0].value
            assert isinstance(num_output, int), "Num output must be int"
            num_input = weight_data_length // num_output
            weight_data = weight_data.reshape((num_input, num_output))
            weight_dict["weight"] = NcnnWeight(weight_data)

            has_bias = layer.params[1].value if 1 in layer.params else 0
            if has_bias == 1:
                bias_data_size = num_output * 4
                bias_data = np.frombuffer(binf.read(bias_data_size), np.float32)
                weight_dict["bias"] = NcnnWeight(bias_data)
        elif op_type == "PReLU":
            num_slope = layer.params[0].value
            assert isinstance(num_slope, int), "Num slopes must be int"
            slope_data_size = num_slope * 4
            slope_data = np.frombuffer(binf.read(slope_data_size), np.float32)
            weight_dict["slope"] = NcnnWeight(slope_data)
        else:
            if len(layer.params.weight_order) != 0:
                error_msg = f"Load weights not added for {op_type} yet, please report"
                raise ValueError(error_msg)

        return weight_dict

    def write_param(self, filename: str = "") -> str:
        with StringIO() as p:
            p.write(f"{self.magic}\n{self.node_count} {self.blob_count}\n")

            for layer in self.layer_list:
                p.write(
                    f"{layer.op_type:<16} "
                    f"{layer.name:<24} "
                    f"{layer.num_inputs} "
                    f"{layer.num_outputs}"
                )
                if layer.inputs:
                    p.write(f" {' '.join(layer.inputs)}")
                if layer.outputs:
                    p.write(f" {' '.join(layer.outputs)}")
                if layer.params:
                    p.write(f" {str(layer.params)}")
                p.write("\n")

            if filename:
                with open(filename, "w", encoding="utf-8") as f:
                    f.write(p.getvalue())
                return ""
            else:
                return p.getvalue()

    def write_bin(self, filename: str) -> None:
        with open(filename, "wb") as f:
            f.write(self.weights_bin)

    def interpolate(self, model_b: "NcnnModel", alpha: float) -> "NcnnModel":
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


class NcnnModelWrapper:
    def __init__(self, model: NcnnModel) -> None:
        self.model: NcnnModel = model
        scale, in_nc, out_nc, nf = self.get_broadcast_data()
        self.scale: int = scale
        self.nf = nf
        self.in_nc: int = in_nc
        self.out_nc: int = out_nc

    def get_broadcast_data(self) -> Tuple[int, int, int, int]:
        scale = 1
        in_nc = 0
        out_nc = 0
        nf = 0
        pixel_shuffle = 1
        found_first_conv = False
        current_conv = None

        for i, layer in enumerate(self.model.layer_list):
            if layer.op_type == "Interp":
                try:
                    if (
                        self.model.layer_list[i + 1].op_type != "BinaryOp"
                        and self.model.layer_list[i + 1].params[0].value != 0
                    ):
                        scale *= layer.params[1].value  # type: ignore
                except IndexError:
                    pass
            elif layer.op_type == "PixelShuffle":
                scale *= layer.params[0].value  # type: ignore
                pixel_shuffle *= int(layer.params[0].value)  # type: ignore
            elif layer.op_type in (
                "Convolution",
                "Convolution1D",
                "ConvolutionDepthWise",
            ):
                if found_first_conv is not True:
                    nf, in_nc = self.get_nf_and_in_nc(layer)
                    found_first_conv = True

                try:
                    scale /= layer.params[3].value  # type: ignore
                except KeyError:
                    pass
                current_conv = layer
            elif layer.op_type in ("Deconvolution", "DeconvolutionDepthWise"):
                try:
                    scale *= layer.params[3].value  # type: ignore
                except KeyError:
                    pass

        out_nc = current_conv.params[0].value // pixel_shuffle**2  # type: ignore

        return int(scale), in_nc, out_nc, nf  # type: ignore

    def get_nf_and_in_nc(self, layer: NcnnLayer) -> Tuple[int, int]:
        nf = layer.params[0].value
        kernel_w = layer.params[1].value
        try:
            kernel_h = layer.params[11].value
        except KeyError:
            kernel_h = kernel_w
        weight_data_size = layer.params[6].value

        assert (
            isinstance(nf, int)
            and isinstance(kernel_w, int)
            and isinstance(kernel_h, int)
            and isinstance(weight_data_size, int)
        ), "Out nc, kernel width and height, and weight data size must all be ints"
        in_nc = weight_data_size // nf // kernel_w // kernel_h

        return nf, in_nc
