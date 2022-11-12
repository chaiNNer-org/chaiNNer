from math import sqrt
import numpy as np
from ncnn_model import NcnnModel


class NcnnOptimizer:
    def __init__(self, model: NcnnModel) -> None:
        self.model = model

    def fuse_batchnorm_scale(self):
        layers_to_remove = []
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "BatchNorm":
                # BatchNorm - Scale
                output = layer.outputs[0]

                j = i + 1
                while j < len(self.model.layers):
                    if self.model.layers[j].op_type != "Scale":
                        continue
                    if len(self.model.layers[j].inputs) != 1:
                        continue
                    if self.model.layers[j].inputs[0] == output:
                        break

                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse BatchNorm - Scale to BatchNorm
                batchnorm = self.model.layers[i]
                scale = self.model.layers[j]

                channels = batchnorm.params[0].value
                slope = batchnorm.weight_data["slope"].weight
                bias = batchnorm.weight_data["bias"].weight

                for c in range(channels):  # type: ignore
                    slope[c] = slope[c] * scale.weight_data["scale"]
                    if scale.params[1]:
                        bias[c] = (
                            bias[c] * scale.weight_data["scale"]
                            + scale.weight_data["bias"]
                        )
                    else:
                        bias[c] = bias[c] * scale.weight_data["scale"]

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                layers_to_remove.append(j)

        for i in layers_to_remove[::-1]:
            self.model.layers.pop(i)

    def fuse_convolution_batchnorm(self):
        layers_to_remove = []
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Convolution":
                # Convolution - BatchNorm
                output = layer.outputs[0]

                j = i + 1
                while j < len(self.model.layers):
                    if self.model.layers[j].op_type != "BatchNorm":
                        j += 1
                        continue
                    if len(self.model.layers[j].inputs) != 1:
                        j += 1
                        continue
                    if self.model.layers[j].inputs[0] == output:
                        break

                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse Convolution - BatchNorm to Convolution
                batchnorm = self.model.layers[j]

                channels = batchnorm.params[0].value
                eps = batchnorm.params[1]

                # a = bias - slope * mean / sqrt(var + eps)
                # b = slope / sqrt(var + eps)
                # value = value * b + a
                a = list(range(channels))  # type: ignore
                b = list(range(channels))  # type: ignore
                for c in range(channels):  # type: ignore
                    sqrt_var = sqrt(batchnorm.weight_data["variance"].weight[i] + eps)
                    a[i] = (
                        batchnorm.weight_data["bias"].weight[i]
                        - batchnorm.weight_data["slope"].weight[i]
                        * batchnorm.weight_data["mean"].weight[i]
                        / sqrt_var
                    )
                    b[i] = batchnorm.weight_data["slope"].weight[i] / sqrt_var

                if layer.params[5] == 0:
                    # init bias as zero
                    layer.params[5] = 1
                    layer.weight_data["bias"] = np.zeros(channels, np.float32)  # type: ignore

                weight_per_outch = layer.params[6] / channels  # type: ignore
                weight = layer.weight_data["weight"].weight
                bias = layer.weight_data["bias"].weight

                for c in range(channels):  # type: ignore
                    conv_weight_outch = weight + weight_per_outch * c
                    for w in range(weight_per_outch):
                        conv_weight_outch[w] *= b[c]

                    bias[i] = bias[i] * b[i] + a[i]

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                layers_to_remove.append(j)

        for i in layers_to_remove[::-1]:
            self.model.layers.pop(i)

    def fuse_convolution_mul(self):
        layers_to_remove = []
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Convolution":
                # Convolution - BatchNorm
                output = layer.outputs[0]

                j = i + 1
                while j < len(self.model.layers):
                    if self.model.layers[j].op_type != "BinaryOp":
                        j += 1
                        continue
                    if len(self.model.layers[j].inputs) != 2:
                        j += 1
                        continue
                    if self.model.layers[j].inputs[0] == output:
                        break

                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse Convolution - BinaryOp to Convolution
                binaryop = self.model.layers[j]

                if binaryop.params[0] != 2 or binaryop.params[1]:
                    continue

                # MemoryData - ..... - BinaryOp
                k = 0
                while k < j:
                    if self.model.layers[k].op_type != "MemoryData":
                        j += 1
                        continue
                    if self.model.layers[k].outputs[0] == binaryop.inputs[1]:
                        break

                    j += 1

                if k == j:
                    continue

                memorydata = self.model.layers[k]

                channels = layer.params[0]

                if (
                    memorydata.params[0] != channels
                    or memorydata.params[1] != 0
                    or memorydata.params[2] != 0
                ):
                    # not bias-like broadcasting type
                    continue

                weight_per_outch = layer.params[6] / channels  # type: ignore
                weight = layer.weight_data["weight"].weight
                bias = layer.weight_data["bias"].weight

                for c in range(channels):  # type: ignore
                    conv_weight_outch = weight + weight_per_outch * c
                    for w in range(weight_per_outch):
                        conv_weight_outch[w] *= memorydata.weight_data["data"].weight[c]

                    if bias:
                        bias[i] = (
                            bias[i] * memorydata.weight_data["data"].weight[i]
                        )  # type: ignore

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                layers_to_remove.append(j)

        for i in layers_to_remove[::-1]:
            self.model.layers.pop(i)

    def fuse_convolution_activation(self):
        layers_to_remove = []
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Convolution":
                # Convolution - Activation
                output = layer.outputs[0]

                j = i + 1
                while j < len(self.model.layers):
                    if self.model.layers[j].op_type not in (
                        "ReLU",
                        "Clip",
                        "Sigmoid",
                        "Mish",
                        "Hardswish",
                    ):
                        j += 1
                        continue
                    if len(self.model.layers[j].inputs) != 1:
                        j += 1
                        continue
                    if self.model.layers[j].inputs[0] == output:
                        break

                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse Convolution - Activation to Convolution
                act = self.model.layers[j]

                if act.op_type == "ReLU":
                    if act.params[0] == 0:
                        layer.params[9] = 1
                    else:
                        layer.params[9] = 2
                        layer.params[10] = [1, act.params[0].value]  # type: ignore

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                layers_to_remove.append(j)

        for i in layers_to_remove[::-1]:
            self.model.layers.pop(i)

    def optimize(self):
        self.fuse_convolution_activation()
        self.fuse_convolution_batchnorm()
        self.fuse_convolution_mul()

        return self.model


if __name__ == "__main__":
    model = NcnnModel().load_from_file(
        "D:/Desktop/onnx_test_models/4x_BSRGAN_old_arch.param"
    )
    optimizer = NcnnOptimizer(model)
    model = optimizer.optimize()
    model.write_param("D:/Desktop/onnx_test_models/opt_test.param")
    model.write_bin("D:/Desktop/onnx_test_models/opt_test.bin")
