import numpy as np

from ...utils.checked_cast import checked_cast
from .model import BinaryOpTypes as BOT
from .model import EltwiseOpTypes as EOT
from .model import NcnnLayer, NcnnModel


class NcnnOptimizer:
    def __init__(self, model: NcnnModel) -> None:
        self.model = model

    def __fuse_batchnorm_scale(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "BatchNorm":
                # BatchNorm - Scale
                batchnorm_output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "Scale":
                        continue
                    if len(self.model.layers[j].inputs) != 1:
                        continue
                    if self.model.layers[j].inputs[0] == batchnorm_output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse BatchNorm - Scale to BatchNorm
                scale = self.model.layers[j]

                bias = layer.weight_data["bias"].weight

                layer.weight_data["slope"].weight = (
                    layer.weight_data["slope"].weight
                    * scale.weight_data["scale"].weight
                )

                bias = bias * scale.weight_data["scale"].weight
                if scale.params[1].value:
                    bias += scale.weight_data["bias"].weight
                layer.weight_data["bias"].weight = bias

                layer.outputs[0] = scale.outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                scale.op_type = "ncnnfused"

    def __fuse_x_batchnorm(self):
        """Combines fuse_convolution_batchnorm, fuse_convolutiondepthwise_batchnorm,
        fuse_deconvolution_batchnorm, fuse_deconvolutiondepthwise_batchnorm, and
        fuse_innerproduct_batchnorm"""

        for i, layer in enumerate(self.model.layers):
            if layer.op_type in (
                "Convolution",
                "ConvolutionDepthWise",
                "Deconvolution",
                "DeconvolutionDepthWise",
                "InnerProduct",
            ):
                # Convolution - BatchNorm
                conv_output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "BatchNorm":
                        continue
                    if len(self.model.layers[j].inputs) != 1:
                        continue
                    if self.model.layers[j].inputs[0] == conv_output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse Convolution - BatchNorm to Convolution
                batchnorm = self.model.layers[j]

                channels = checked_cast(int, batchnorm.params[0].value)
                eps = checked_cast(float, batchnorm.params[1].value)

                # a = bias - slope * mean / sqrt(var + eps)
                # b = slope / sqrt(var + eps)
                # value = value * b + a
                a = np.ndarray((channels,))
                b = np.ndarray((channels,))
                sqrt_var = np.sqrt(batchnorm.weight_data["variance"].weight + eps)
                a = (
                    batchnorm.weight_data["bias"].weight
                    - batchnorm.weight_data["slope"].weight
                    * batchnorm.weight_data["mean"].weight
                    / sqrt_var
                )
                b = batchnorm.weight_data["slope"].weight / sqrt_var

                bias_term = 1 if layer.op_type == "InnerProduct" else 5

                if layer.params[bias_term].value == 0:
                    # init bias as zero
                    layer.params[bias_term] = 1
                    layer.add_weight("bias", np.zeros(channels, dtype=np.float32))

                weight = layer.weight_data["weight"].weight
                layer.weight_data["weight"].weight = weight * (
                    np.transpose(
                        np.broadcast_to(b, weight.shape[::-1]).astype(weight.dtype),
                        (3, 2, 1, 0),
                    )
                )

                layer.weight_data["bias"].weight = (
                    layer.weight_data["bias"].weight * b + a
                )

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                batchnorm.op_type = "ncnnfused"

    def __fuse_x_mul(self):
        """Combines fuse_convolution_mul, fuse_convolutiondepthwise_mul,
        and fuse_deconvolution_mul"""

        for i, layer in enumerate(self.model.layers):
            if layer.op_type in (
                "Convolution",
                "ConvolutionDepthWise",
                "Deconvolution",
            ):
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

                channels = checked_cast(int, layer.params[0].value)

                if (
                    memorydata.params[0].value != channels
                    or memorydata.params[1].value != 0
                    or memorydata.params[2].value != 0
                ):
                    # not bias-like broadcasting type
                    continue

                data = memorydata.weight_data["data"].weight

                weight = layer.weight_data["weight"].weight
                layer.weight_data["weight"].weight = weight * (
                    np.transpose(
                        np.broadcast_to(data, weight.shape[::-1]).astype(weight.dtype),
                        (3, 2, 1, 0),
                    )
                )

                try:
                    layer.weight_data["bias"].weight = (
                        layer.weight_data["bias"].weight * data
                    )
                except KeyError:
                    pass

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                binaryop.op_type = "ncnnfused"

    def __fuse_x_add(self):
        """Combines fuse_convolution_add, fuse_convolutiondepthwise_add,
        fuse_deconvolution_add, and fuse_innerproduct_add"""

        for i, layer in enumerate(self.model.layers):
            if layer.op_type in (
                "Convolution",
                "ConvolutionDepthWise",
                "Deconvolution",
                "InnerProduct",
            ):
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

                channels = checked_cast(int, layer.params[0].value)

                if not (
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

                bias_term = 1 if layer.op_type == "InnerProduct" else 5
                bias_data = memorydata.weight_data["data"].weight.reshape(channels)

                if layer.params[bias_term].value == 0:
                    # init bias
                    layer.params[bias_term] = 1
                    layer.add_weight("bias", bias_data)
                else:
                    layer.weight_data["bias"].weight = (
                        layer.weight_data["bias"].weight + bias_data
                    )

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                binaryop.op_type = "ncnnfused"

    def __fuse_innerproduct_dropout(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "InnerProduct":
                # InnerProduct - Dropout
                output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "Dropout":
                        continue
                    if self.model.layers[j].num_inputs != 1:
                        continue
                    if self.model.layers[j].inputs[0] == output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse InnerProduct - Dropout to InnerProduct
                dropout = self.model.layers[j]

                scale = checked_cast(float, dropout.params[0].value)
                if scale != 1:
                    layer.weight_data["weight"].weight = (
                        layer.weight_data["weight"].weight * scale
                    )

                    if layer.params[1].value == 1:
                        layer.weight_data["bias"].weight = (
                            layer.weight_data["bias"].weight * scale
                        )

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                dropout.op_type = "ncnnfused"

    def __fuse_x_activation(self):
        """Combines fuse_convolution_activation, fuse_convolution1d_activation,
        fuse_convolutiondepthwise_activation, fuse_deconvolution_activation,
        fuse_deconvolutiondepthwise_activation, and fuse_innerproduct_activation"""

        for i, layer in enumerate(self.model.layers):
            if layer.op_type in (
                "Convolution",
                "Convolution1D",
                "ConvolutionDepthWise",
                "Deconvolution",
                "DeconvolutionDepthWise",
                "InnerProduct",
            ):
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
                    if (
                        self.model.layers[j].op_type == "Mish"
                        and layer.op_type in ("Deconvolution", "DeconvolutionDepthWise")
                    ) or (
                        self.model.layers[j].op_type == "HardSwish"
                        and layer.op_type
                        in (
                            "Convolution1D",
                            "Deconvolution",
                            "DeconvolutionDepthWise",
                        )
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
                        layer.params[10] = [1, checked_cast(float, act.params[0].value)]
                elif act.op_type == "Clip":
                    layer.params[9] = 3
                    layer.params[10] = [
                        2,
                        checked_cast(float, act.params[0].value),
                        checked_cast(float, act.params[1].value),
                    ]
                elif act.op_type == "Sigmoid":
                    layer.params[9] = 4
                elif act.op_type == "Mish":
                    layer.params[9] = 5
                elif act.op_type == "HardSwish":
                    layer.params[9] = 6
                    layer.params[10] = [
                        2,
                        checked_cast(float, act.params[0].value),
                        checked_cast(float, act.params[1].value),
                    ]

                self.model.layers[i].outputs[0] = self.model.layers[j].outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                act.op_type = "ncnnfused"

    def __fuse_memorydata_binaryop(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "MemoryData":
                # MemoryData - BinaryOp
                output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "BinaryOp":
                        continue
                    if self.model.layers[j].num_inputs != 2:
                        continue
                    if output in (
                        self.model.layers[j].inputs[0],
                        self.model.layers[j].inputs[1],
                    ):
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                # fuse MemoryData - BinaryOp to BinaryOp
                binaryop = self.model.layers[j]

                if (
                    layer.params[0].value != 1
                    or layer.params[1].value != 0
                    or layer.params[2].value != 0
                ):
                    # not a scalar
                    continue

                memorydata_index = 1
                if binaryop.inputs[0] == output:
                    op_type = checked_cast(int, binaryop.params[0].value)
                    if op_type == BOT.ADD:
                        memorydata_index = 0
                    elif op_type == BOT.SUB:
                        binaryop.params[0] = BOT.RSUB
                        memorydata_index = 0
                    elif op_type == BOT.DIV:
                        binaryop.params[0] = BOT.RDIV
                        memorydata_index = 0
                    else:
                        # non-interchangeable binaryop
                        continue

                binaryop.params[1] = 1
                binaryop.params[2] = layer.weight_data["data"].weight[0]

                binaryop.inputs.pop(memorydata_index)
                self.model.node_count -= 1
                self.model.blob_count -= 1
                layer.op_type = "ncnnfused"

        i = 0
        while i in range(len(self.model.layers)):
            if self.model.layers[i].op_type != "MemoryData":
                # MemoryData - Split - BinaryOp
                output = self.model.layers[i].outputs[0]

                j0 = i
                for j0 in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j0].op_type != "Split":
                        continue
                    if self.model.layers[j0].num_inputs != 1:
                        continue
                    if self.model.layers[j0].inputs[0] == output:
                        break
                else:
                    j0 += 1

                if j0 == len(self.model.layers):
                    i += 1
                    continue

                split_output_index = -1
                j1 = i
                for j1 in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j1].op_type != "BinaryOp":
                        continue
                    if self.model.layers[j1].num_inputs != 2:
                        continue
                    for k in range(self.model.layers[j0].num_outputs):
                        if (
                            self.model.layers[j1].inputs[0]
                            == self.model.layers[j0].outputs[k]
                            or self.model.layers[j1].inputs[1]
                            == self.model.layers[j0].outputs[k]
                        ):
                            split_output_index = k
                            break
                    if split_output_index != -1:
                        break
                else:
                    j1 += 1

                if j1 == len(self.model.layers):
                    i += 1
                    continue

                # fuse MemoryData - Split - BinaryOp to BinaryOp
                split = self.model.layers[j0]
                binaryop = self.model.layers[j1]

                if (
                    self.model.layers[i].params[0].value != 1
                    or self.model.layers[i].params[1].value != 0
                    or self.model.layers[i].params[2].value != 0
                ):
                    # not a scalar
                    i += 1
                    continue

                memorydata_index = 1
                if binaryop.inputs[0] == split.outputs[split_output_index]:
                    op_type = checked_cast(int, binaryop.params[0].value)
                    if op_type in (BOT.ADD, BOT.MUL, BOT.MAX, BOT.MIN):
                        memorydata_index = 0
                    elif op_type == BOT.SUB:
                        binaryop.params[0] = BOT.RSUB
                        memorydata_index = 0
                    elif op_type == BOT.DIV:
                        binaryop.params[0] = BOT.RDIV
                        memorydata_index = 0
                    else:
                        # non-interchangeable binaryop
                        i += 1
                        continue

                binaryop.params[1] = 1
                binaryop.params[2] = self.model.layers[i].weight_data["data"].weight[0]

                binaryop.inputs.pop(memorydata_index)
                binaryop.num_inputs -= 1
                split.outputs.pop(split_output_index)
                split.num_outputs -= 1
                if split.num_outputs == 0:
                    self.model.node_count -= 2
                    self.model.blob_count -= 2
                    split.op_type = "ncnnfused"
                    self.model.layers[i].op_type = "ncnnfused"

                i -= 1

            i += 1

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
                if i not in (j0, j1):
                    # fuse BinaryOp - BinaryOp - BinaryOp to Eltwise
                    eltwise.add_param(
                        1,
                        [
                            2,
                            checked_cast(float, binaryop0.params[2].value),
                            checked_cast(float, binaryop1.params[2].value),
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
                        1, [2, checked_cast(float, binaryop0.params[2].value), 1.0]
                    )
                    eltwise.inputs[0] = binaryop0.inputs[0]
                    self.model.node_count -= 1
                    self.model.blob_count -= 1
                    binaryop0.op_type = "ncnnfused"
                else:
                    # fuse X - BinaryOp - BinaryOp to Eltwise
                    eltwise.add_param(
                        1, [2, 1.0, checked_cast(float, binaryop1.params[2].value)]
                    )
                    eltwise.inputs[1] = binaryop1.inputs[0]
                    self.model.node_count -= 1
                    self.model.blob_count -= 1
                    binaryop1.op_type = "ncnnfused"

                self.model.layers[i] = eltwise

    def __eliminate_dropout(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Dropout":
                if layer.params[0].value != 1:
                    continue

                # Any - Dropout
                dropout_input = layer.inputs[0]

                j = i - 1
                for j in range(i - 1, -1, -1):
                    if self.model.layers[j].op_type == "ncnnfused":
                        continue
                    if self.model.layers[j].num_outputs != 1:
                        continue
                    if self.model.layers[j].outputs[0] == dropout_input:
                        break
                else:
                    j -= 1

                if j == -1:
                    continue

                self.model.layers[j].outputs[0] = layer.outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                layer.op_type = "ncnnfused"

    def __eliminate_pooling1x1(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Pooling":
                if (
                    layer.params[3].value != 0
                    or layer.params[13].value != 0
                    or layer.params[14].value != 0
                    or layer.params[15].value != 0
                ):
                    continue
                if (
                    layer.params[1].value != 1
                    or layer.params[11].value != 1
                    or layer.params[2].value != 1
                    or layer.params[12].value != 1
                ):
                    continue
                if layer.params[4].value != 0:
                    continue

                # Any - Pooling
                pooling_input = layer.inputs[0]

                top_i = -1
                j = i - 1
                for j in range(i - 1, -1, -1):
                    if self.model.layers[j].op_type == "ncnnfused":
                        continue

                    for k in range(self.model.layers[j].num_outputs):
                        if self.model.layers[j].outputs[k] == pooling_input:
                            top_i = k
                            break

                    if top_i != -1:
                        break
                else:
                    j -= 1

                if j == -1:
                    continue

                self.model.layers[j].outputs[top_i] = layer.outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                layer.op_type = "ncnnfused"

    def __eliminate_noop(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Noop":
                if layer.num_inputs == 0:
                    # Noop
                    layer.op_type = "ncnnfused"
                    continue

                # Any - Noop
                noop_input = layer.inputs[0]

                j = i - 1
                any_k = -1
                for j in range(i - 1, -1, -1):
                    if self.model.layers[j].op_type == "ncnnfused":
                        continue

                    link_noop = False
                    for k in range(self.model.layers[j].num_outputs):
                        if self.model.layers[j].outputs[k] == noop_input:
                            link_noop = True
                            any_k = k
                            break

                    if link_noop:
                        break
                else:
                    j -= 1

                if j == -1 or any_k == -1:
                    continue

                self.model.layers[j].outputs[any_k] = layer.outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                layer.op_type = "ncnnfused"

    def __eliminate_split(self):
        blob_input_references = []
        for i, layer in enumerate(self.model.layers):
            for input_name in layer.inputs:
                blob_input_references.append(input_name)

        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Split":
                real_split_output_count = 0
                real_split_output_index = -1
                for j in range(layer.num_outputs):
                    if layer.outputs[j] in blob_input_references:
                        real_split_output_count += 1
                        real_split_output_index = j

                if real_split_output_count > 1:
                    continue

                # Any - Pooling
                split_input = layer.inputs[0]

                top_i = -1
                j = i - 1
                for j in range(i - 1, -1, -1):
                    if self.model.layers[j].op_type == "ncnnfused":
                        continue

                    for k in range(self.model.layers[j].num_outputs):
                        if self.model.layers[j].outputs[k] == split_input:
                            top_i = k
                            break

                    if top_i != -1:
                        break
                else:
                    j -= 1

                if j == -1:
                    continue

                self.model.layers[j].outputs[top_i] = layer.outputs[
                    real_split_output_index
                ]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                layer.op_type = "ncnnfused"

    def __eliminate_orphaned_memorydata(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "MemoryData":
                # MemoryData - X
                memdata_output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type == "ncnnfused":
                        continue

                    orphaned = True
                    for k in range(self.model.layers[j].num_inputs):
                        if self.model.layers[j].inputs[k] == memdata_output:
                            orphaned = False
                            break

                    if not orphaned:
                        break

                if j < len(self.model.layers):
                    continue

                self.model.node_count -= 1
                self.model.blob_count -= 1
                layer.op_type = "ncnnfused"

    def __eliminate_reshape_after_global_pooling(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Pooling":
                if layer.params[4].value == 0:
                    continue

                # Pooling - Reshape
                pooling_output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "Reshape":
                        continue
                    if self.model.layers[j].num_inputs != 1:
                        continue
                    if self.model.layers[j].inputs[0] == pooling_output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                reshape = self.model.layers[j]

                if (
                    reshape.params[1].value != -233
                    or reshape.params[2].value != -233
                    or reshape.params[3].value != 0
                ):
                    continue

                layer.outputs[0] = reshape.outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                reshape.op_type = "ncnnfused"

    def __eliminate_flatten_after_global_pooling(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Pooling":
                if layer.params[4].value == 0:
                    continue

                # Pooling - Flatten
                pooling_output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "Flatten":
                        continue
                    if self.model.layers[j].num_inputs != 1:
                        continue
                    if self.model.layers[j].inputs[0] == pooling_output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                flatten = self.model.layers[j]

                layer.outputs[0] = flatten.outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                flatten.op_type = "ncnnfused"

    def __eliminate_flatten_after_innerproduct(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "InnerProduct":
                # InnerProduct - Flatten
                inprod_output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "Flatten":
                        continue
                    if self.model.layers[j].num_inputs != 1:
                        continue
                    if self.model.layers[j].inputs[0] == inprod_output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                flatten = self.model.layers[j]

                layer.outputs[0] = flatten.outputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                flatten.op_type = "ncnnfused"

    def __eliminate_reshape_before_binaryop(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Reshape":
                if (
                    layer.params[0].value != 1
                    or layer.params[1].value != 1
                    or layer.params[3].value != 1
                ):
                    continue

                # Reshape - BinaryOp
                reshape_output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "BinaryOp":
                        continue
                    if self.model.layers[j].num_inputs != 2:
                        continue
                    if reshape_output in (
                        self.model.layers[j].inputs[0],
                        self.model.layers[j].inputs[1],
                    ):
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                binaryop = self.model.layers[j]

                input_blob_final = layer.inputs[0]
                if binaryop.inputs[0] == reshape_output:
                    binaryop.inputs[0] = input_blob_final
                if binaryop.inputs[1] == reshape_output:
                    binaryop.inputs[1] = input_blob_final
                self.model.node_count -= 1
                self.model.blob_count -= 1
                layer.op_type = "ncnnfused"

    def __replace_reduction_with_global_pooling(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Reduction":
                if (
                    layer.params[0].value != 3
                    or layer.params[1].value != 0
                    or layer.params[2].value != 1
                ):
                    continue

                axes = checked_cast(list, layer.params[3].value)
                if len(axes) != 1:
                    continue
                if axes[0] != 2 and axes[0] != 3:
                    continue

                # Reduction(2/3) - Reduction(2)
                reduction1_output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "Reduction":
                        continue
                    if self.model.layers[j].num_inputs != 1:
                        continue
                    if self.model.layers[j].inputs[0] == reduction1_output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                reduction2 = self.model.layers[j]

                if (
                    reduction2.params[0].value != 3
                    or reduction2.params[1].value != 0
                    or reduction2.params[2].value != 1
                ):
                    continue

                axes2 = checked_cast(list, layer.params[3].value)
                if len(axes2) != 1:
                    continue
                if axes2[0] != 2:
                    continue

                pooling = NcnnLayer(
                    "Pooling",
                    reduction2.name,
                    reduction2.num_inputs,
                    reduction2.num_outputs,
                    reduction2.inputs,
                    reduction2.outputs,
                )
                pooling.add_param(0, 1)
                pooling.add_param(4, 1)

                self.model.layers[j] = pooling

                pooling.inputs[0] = layer.inputs[0]
                self.model.node_count -= 1
                self.model.blob_count -= 1
                layer.op_type = "ncnnfused"

    def __replace_prelu_with_leaky_relu(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "PReLU":
                if layer.params[0].value != 1:
                    continue

                relu_layer = NcnnLayer(
                    "ReLU",
                    layer.name,
                    layer.num_inputs,
                    layer.num_outputs,
                    layer.inputs,
                    layer.outputs,
                )
                relu_layer.add_param(
                    0, checked_cast(float, layer.weight_data["slope"].weight[0])
                )

                self.model.layers[i] = relu_layer

    def __replace_convolution_with_innerproduct_after_global_pooling(self):
        for i, layer in enumerate(self.model.layers):
            if layer.op_type == "Pooling":
                if layer.params[4].value == 0:
                    continue

                # Pooling - Convolution
                pooling_output = layer.outputs[0]

                j = i
                for j in range(i + 1, len(self.model.layers)):
                    if self.model.layers[j].op_type != "Convolution":
                        continue
                    if self.model.layers[j].num_inputs != 1:
                        continue
                    if self.model.layers[j].inputs[0] == pooling_output:
                        break
                else:
                    j += 1

                if j == len(self.model.layers):
                    continue

                convolution = self.model.layers[j]

                innerproduct = NcnnLayer(
                    "InnerProduct",
                    convolution.name,
                    convolution.num_inputs,
                    convolution.num_outputs,
                    convolution.inputs,
                    convolution.outputs,
                )
                innerproduct.add_param(
                    0, checked_cast(int, convolution.params[0].value)
                )
                innerproduct.add_param(
                    1, checked_cast(int, convolution.params[5].value)
                )
                innerproduct.add_param(
                    2, checked_cast(int, convolution.params[6].value)
                )
                innerproduct.add_param(
                    8, checked_cast(int, convolution.params[8].value)
                )
                innerproduct.add_param(
                    9, checked_cast(int, convolution.params[9].value)
                )
                innerproduct.add_param(
                    10,
                    checked_cast(list, convolution.params[10].value),
                )
                innerproduct.add_weight(
                    "weight",
                    convolution.weight_data["weight"].weight,
                    convolution.weight_data["weight"].quantize_tag,
                )
                innerproduct.add_weight("bias", convolution.weight_data["bias"].weight)

                self.model.layers[j] = innerproduct

    def __replace_convolution_with_innerproduct_after_innerproduct(self):
        while True:
            replaced = False
            for i, layer in enumerate(self.model.layers):
                if layer.op_type == "InnerProduct":
                    # InnerProduct - Convolution
                    inprod_output = layer.outputs[0]

                    j = i
                    for j in range(i + 1, len(self.model.layers)):
                        if self.model.layers[j].op_type != "Convolution":
                            continue
                        if self.model.layers[j].num_inputs != 1:
                            continue
                        if self.model.layers[j].inputs[0] == inprod_output:
                            break
                    else:
                        j += 1

                    if j == len(self.model.layers):
                        continue

                    convolution = self.model.layers[j]
                    innerproduct2 = NcnnLayer(
                        "InnerProduct",
                        convolution.name,
                        convolution.num_inputs,
                        convolution.num_outputs,
                        convolution.inputs,
                        convolution.outputs,
                    )
                    innerproduct2.add_param(
                        0, checked_cast(int, convolution.params[0].value)
                    )
                    innerproduct2.add_param(
                        1, checked_cast(int, convolution.params[5].value)
                    )
                    innerproduct2.add_param(
                        2, checked_cast(int, convolution.params[6].value)
                    )
                    innerproduct2.add_param(
                        8, checked_cast(int, convolution.params[8].value)
                    )
                    innerproduct2.add_param(
                        9, checked_cast(int, convolution.params[9].value)
                    )
                    innerproduct2.add_param(
                        10,
                        checked_cast(list, convolution.params[10].value),
                    )
                    innerproduct2.add_weight(
                        "weight",
                        convolution.weight_data["weight"].weight,
                        convolution.weight_data["weight"].quantize_tag,
                    )
                    innerproduct2.add_weight(
                        "bias", convolution.weight_data["bias"].weight
                    )

                    self.model.layers[j] = innerproduct2

                    replaced = True

            if not replaced:
                break

    def optimize(self) -> None:
        self.__fuse_batchnorm_scale()
        self.__fuse_x_batchnorm()
        self.__fuse_x_mul()
        self.__fuse_x_add()
        self.__fuse_innerproduct_dropout()

        self.__replace_reduction_with_global_pooling()
        self.__replace_prelu_with_leaky_relu()

        self.__fuse_x_activation()
        self.__fuse_memorydata_binaryop()
        self.__fuse_binaryop_eltwise()

        self.__eliminate_dropout()
        self.__eliminate_pooling1x1()
        self.__eliminate_noop()
        self.__eliminate_split()
        self.__eliminate_flatten_after_global_pooling()
        self.__eliminate_reshape_after_global_pooling()
        self.__eliminate_reshape_before_binaryop()

        self.__replace_convolution_with_innerproduct_after_global_pooling()
        self.__replace_convolution_with_innerproduct_after_innerproduct()

        self.__eliminate_flatten_after_innerproduct()
        self.__eliminate_orphaned_memorydata()
