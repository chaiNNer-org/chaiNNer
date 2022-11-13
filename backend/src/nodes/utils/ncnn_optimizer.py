from math import sqrt

import numpy as np
from typing import cast
from ncnn_model import BinaryOpTypes as BOT
from ncnn_model import EltwiseOpTypes as EOT
from ncnn_model import NcnnLayer, NcnnModel


class NcnnOptimizer:
    def __init__(self, model: NcnnModel) -> None:
        self.model = model

    def __fuse_batchnorm_scale(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "BatchNorm":
                # BatchNorm - Scale
                output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "Scale":
                        continue
                    if len(self.model.layers[j].inputs) != 1:
                        continue
                    if self.model.layers[j].inputs[0] == output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse BatchNorm - Scale to BatchNorm
                batchnorm = self.model.layers[i]
                scale = self.model.layers[j]

                channels = cast(int, batchnorm.params[0].value)
                slope = batchnorm.weight_data["slope"].weight
                bias = batchnorm.weight_data["bias"].weight

                for c in range(channels):
                    slope[c] = slope[c] * scale.weight_data["scale"]
                    if scale.params[1].value:
                        bias[c] = (
                            bias[c] * scale.weight_data["scale"]
                            + scale.weight_data["bias"]
                        )
                    else:
                        bias[c] = bias[c] * scale.weight_data["scale"]

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                scale.op_type = "ncnnfused"

    def __fuse_convolution_batchnorm(self):
        for i, layer in enumerate(self.model.layers):
            if (
                layer.op_type == "Convolution"
                or layer.op_type == "ConvolutionDepthWise"
            ):
                # Convolution - BatchNorm
                output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "BatchNorm":
                        continue
                    if len(self.model.layers[j].inputs) != 1:
                        continue
                    if self.model.layers[j].inputs[0] == output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse Convolution - BatchNorm to Convolution
                batchnorm = self.model.layers[j]

                channels = cast(int, batchnorm.params[0].value)
                eps = batchnorm.params[1].value

                # a = bias - slope * mean / sqrt(var + eps)
                # b = slope / sqrt(var + eps)
                # value = value * b + a
                a = list(range(channels))
                b = list(range(channels))
                for c in range(channels):
                    sqrt_var = sqrt(batchnorm.weight_data["variance"].weight[i] + eps)
                    a[i] = (
                        batchnorm.weight_data["bias"].weight[i]
                        - batchnorm.weight_data["slope"].weight[i]
                        * batchnorm.weight_data["mean"].weight[i]
                        / sqrt_var
                    )
                    b[i] = batchnorm.weight_data["slope"].weight[i] / sqrt_var

                if layer.params[5].value == 0:
                    # init bias as zero
                    layer.params[5] = 1
                    layer.add_weight(np.zeros(channels, np.float32), "bias")

                weight_per_outch = cast(int, layer.params[6].value) // channels
                weight = layer.weight_data["weight"].weight
                bias = layer.weight_data["bias"].weight

                for c in range(channels):
                    conv_weight_outch = weight + weight_per_outch * c
                    for w in range(weight_per_outch):
                        conv_weight_outch[w] *= b[c]

                    bias[i] = bias[i] * b[i] + a[i]

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                batchnorm.op_type = "ncnnfused"

    def __fuse_convolution_mul(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Convolution":
                # Convolution - BinaryOp
                output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "BinaryOp":
                        continue
                    if self.model.layers[j].num_inputs != 2:
                        continue
                    if self.model.layers[j].inputs[0] == output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse Convolution - BinaryOp to Convolution
                binaryop = self.model.layers[j]

                if binaryop.params[0].value != BOT.MUL or binaryop.params[1].value:
                    continue

                # MemoryData - ..... - BinaryOp
                k = 0
                for k in range(j):
                    if self.model.layers[k].op_type != "MemoryData":
                        continue
                    if self.model.layers[k].outputs[0] == binaryop.inputs[1]:
                        break
                else:
                    k += 1

                if k == j:
                    continue

                memorydata = self.model.layers[k]

                channels = cast(int, layer.params[0].value)

                if (
                    memorydata.params[0].value != channels
                    or memorydata.params[1].value != 0
                    or memorydata.params[2].value != 0
                ):
                    # not bias-like broadcasting type
                    continue

                weight_per_outch = cast(int, layer.params[6].value) // channels
                weight = layer.weight_data["weight"].weight
                bias = layer.weight_data["bias"].weight

                for c in range(channels):
                    conv_weight_outch = weight + weight_per_outch * c
                    for w in range(weight_per_outch):
                        conv_weight_outch[w] *= memorydata.weight_data["data"].weight[c]

                    if bias:
                        bias[i] = bias[i] * memorydata.weight_data["data"].weight[i]

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                binaryop.op_type = "ncnnfused"

    def __fuse_convolution_add(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Convolution":
                # Convolution - Add
                output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "BinaryOp":
                        continue
                    if self.model.layers[j].num_inputs != 2:
                        continue
                    if self.model.layers[j].inputs[0] == output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse Convolution - BinaryOp to Convolution
                binaryop = self.model.layers[j]

                if binaryop.params[0].value != BOT.ADD or binaryop.params[1].value:
                    continue

                # MemoryData - ..... - BinaryOp
                k = 0
                for k in range(j):
                    if self.model.layers[k].op_type != "MemoryData":
                        continue
                    if self.model.layers[k].outputs[0] == binaryop.inputs[1]:
                        break
                else:
                    k += 1

                if k == j:
                    continue

                memorydata = self.model.layers[k]

                channels = cast(int, layer.params[0].value)

                if (
                    memorydata.params[0].value == channels
                    and memorydata.params[1].value == 0
                    and memorydata.params[2].value == 0
                ) or (
                    memorydata.params[0].value == 1
                    and memorydata.params[1].value == 1
                    and memorydata.params[2].value == channels
                ):
                    # not bias-like broadcasting type
                    continue

                bias_data = memorydata.weight_data["data"].weight.reshape(channels)

                if layer.params[5].value == 0:
                    # init bias
                    layer.params[5] = 1
                    layer.add_weight(bias_data, "bias")
                else:
                    bias = layer.weight_data["bias"].weight
                    for c in range(channels):
                        bias[c] = bias[c] + bias_data[c]

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                binaryop.op_type = "ncnnfused"

    def __fuse_convolution_activation(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Convolution":
                # Convolution - Activation
                output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type not in (
                        "ReLU",
                        "Clip",
                        "Sigmoid",
                        "Mish",
                        "Hardswish",
                    ):
                        continue
                    if self.model.layers[j].num_inputs != 1:
                        continue
                    if self.model.layers[j].inputs[0] == output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse Convolution - Activation to Convolution
                act = self.model.layers[j]

                if act.op_type == "ReLU":
                    if act.params[0].value == 0:
                        layer.params[9] = 1
                    else:
                        layer.params[9] = 2
                        layer.params[10] = [1, cast(float, act.params[0].value)]

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                act.op_type = "ncnnfused"

    def __fuse_binaryop_eltwise(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "BinaryOp":
                if layer.num_inputs != 2:
                    continue
                if layer.params[0].value != BOT.ADD or layer.params[1].value:
                    continue

                # BinaryOp - BinaryOp - BinaryOp
                input0 = layer.inputs[0]
                input1 = layer.inputs[1]

                j0 = 0
                for j0 in range(i):
                    if self.model.layers[j0].op_type != "BinaryOp":
                        continue
                    if self.model.layers[j0].num_inputs != 1:
                        continue
                    if self.model.layers[j0].params[0].value != BOT.MUL:
                        continue
                    if self.model.layers[j0].outputs[0] == input0:
                        break
                else:
                    j0 += 1

                j1 = 0
                for j1 in range(i):
                    if self.model.layers[j1].op_type != "BinaryOp":
                        continue
                    if self.model.layers[j1].num_inputs != 1:
                        continue
                    if self.model.layers[j1].params[0].value != BOT.MUL:
                        continue
                    if self.model.layers[j1].outputs[0] == input1:
                        break
                else:
                    j1 += 1

                if j0 == i and j1 == i:
                    continue

                binaryop0 = self.model.layers[j0]
                binaryop1 = self.model.layers[j1]

                eltwise = NcnnLayer(
                    "Eltwise",
                    layer.name,
                    layer.num_inputs,
                    layer.num_outputs,
                    layer.inputs,
                    layer.outputs,
                )
                eltwise.add_param(0, EOT.SUM)
                if j0 != i and j1 != i:
                    # fuse BinaryOp - BinaryOp - BinaryOp to Eltwise
                    eltwise.add_param(
                        1,
                        [
                            2,
                            cast(float, binaryop0.params[2].value),
                            cast(float, binaryop1.params[2].value),
                        ],
                    )
                    eltwise.inputs[0] = binaryop0.inputs[0]
                    eltwise.inputs[1] = binaryop1.inputs[0]
                    self.model.node_count -= 2
                    self.model.blob_count -= 2
                    binaryop0.op_type = "ncnnfused"
                    binaryop1.op_type = "ncnnfused"
                elif j0 != i and j1 == i:
                    # fuse BinaryOp - X - BinaryOp to Eltwise
                    eltwise.add_param(
                        1, [2, cast(float, binaryop0.params[2].value), 1.0]
                    )
                    eltwise.inputs[0] = binaryop0.inputs[0]
                    self.model.node_count -= 1
                    self.model.blob_count -= 1
                    binaryop0.op_type = "ncnnfused"
                else:
                    # fuse X - BinaryOp - BinaryOp to Eltwise
                    eltwise.add_param(
                        1, [2, 1.0, cast(float, binaryop1.params[2].value)]
                    )
                    eltwise.inputs[1] = binaryop1.inputs[0]
                    self.model.node_count -= 1
                    self.model.blob_count -= 1
                    binaryop1.op_type = "ncnnfused"

                self.model.layers[i] = eltwise

    def optimize(self):
        self.__fuse_batchnorm_scale()
        self.__fuse_convolution_batchnorm()
        self.__fuse_convolution_mul()
        self.__fuse_convolution_add()

        self.__fuse_convolution_activation()
        self.__fuse_binaryop_eltwise()

        return self.model


if __name__ == "__main__":
    model = NcnnModel().load_from_file(
        "D:/Desktop/onnx_test_models/4x_BSRGAN_old_arch.param"
    )
    optimizer = NcnnOptimizer(model)
    model = optimizer.optimize()
    model.write_param("D:/Desktop/onnx_test_models/opt_test.param")
    model.write_bin("D:/Desktop/onnx_test_models/opt_test.bin")
