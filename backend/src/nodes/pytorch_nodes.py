"""
Nodes that provide functionality for pytorch inference
"""

from __future__ import annotations

from io import BytesIO
import os
from typing import Any, OrderedDict, Union

import numpy as np
import torch
from sanic.log import logger

from .categories import PYTORCH
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.architecture.RRDB import RRDBNet as ESRGAN
from .utils.architecture.SPSR import SPSRNet as SPSR
from .utils.architecture.SRVGG import SRVGGNetCompact as RealESRGANv2
from .utils.architecture.SwiftSRGAN import Generator as SwiftSRGAN
from .utils.pytorch_auto_split import auto_split_process
from .utils.utils import get_h_w_c, np2tensor, tensor2np, convenient_upscale


from .utils.torch_types import PyTorchModel


def check_env():
    os.environ["device"] = (
        "cuda" if torch.cuda.is_available() and os.environ["device"] != "cpu" else "cpu"
    )


def load_state_dict(state_dict) -> PyTorchModel:
    logger.info(f"Loading state dict into ESRGAN model")

    # SRVGGNet Real-ESRGAN (v2)
    if (
        "params" in state_dict.keys() and "body.0.weight" in state_dict["params"].keys()
    ) or (
        "body.0.weight" in state_dict.keys() and "body.1.weight" in state_dict.keys()
    ):
        model = RealESRGANv2(state_dict)
    # SPSR (ESRGAN with lots of extra layers)
    elif "f_HR_conv1.0.weight" in state_dict:
        model = SPSR(state_dict)
    # Swift-SRGAN
    elif (
        "model" in state_dict.keys()
        and "initial.cnn.depthwise.weight" in state_dict["model"].keys()
    ):
        model = SwiftSRGAN(state_dict)
    # Regular ESRGAN, "new-arch" ESRGAN, Real-ESRGAN v1
    else:
        try:
            model = ESRGAN(state_dict)
        except:
            # pylint: disable=raise-missing-from
            raise ValueError("Model unsupported by chaiNNer. Please try another.")
    return model


@NodeFactory.register("chainner:pytorch:load_model")
class LoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Load PyTorch state dict file (.pth) into an auto-detected supported model architecture.
            Supports most variations of the RRDB architecture
            (ESRGAN, Real-ESRGAN, RealSR, BSRGAN, SPSR),
            Real-ESRGAN's SRVGG architecture, and Swift-SRGAN."""
        self.inputs = [PthFileInput()]
        self.outputs = [
            ModelOutput(kind="pytorch", should_broadcast=True),
            TextOutput("Model Name"),
        ]

        self.category = PYTORCH
        self.name = "Load Model"
        self.icon = "PyTorch"
        self.sub = "Input & Output"

    def run(self, path: str) -> Tuple[PyTorchModel, str]:
        """Read a pth file from the specified path and return it as a state dict
        and loaded model after finding arch config"""

        assert os.path.exists(path), f"Model file at location {path} does not exist"

        assert os.path.isfile(path), f"Path {path} is not a file"

        check_env()

        try:
            logger.info(f"Reading state dict from path: {path}")
            state_dict = torch.load(
                path, map_location=torch.device(os.environ["device"])
            )
            model = load_state_dict(state_dict)

            for _, v in model.named_parameters():
                v.requires_grad = False
            model.eval()
            model = model.to(torch.device(os.environ["device"]))
        except ValueError as e:
            raise e
        except Exception:
            # pylint: disable=raise-missing-from
            raise ValueError("Model unsupported by chaiNNer. Please try another.")

        basename = os.path.splitext(os.path.basename(path))[0]

        return model, basename


@NodeFactory.register("chainner:pytorch:upscale_image")
@torch.inference_mode()
class ImageUpscaleNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Upscales an image using a PyTorch Super-Resolution model."
        self.inputs = [ModelInput(), ImageInput()]
        self.outputs = [
            ImageOutput(
                "Upscaled Image",
                image_type="""
                Image {
                    width: multiply(Input0.scale, Input1.width),
                    height: multiply(Input0.scale, Input1.height),
                    channels: getUpscaleChannels(Input1.channels, Input0.inputChannels, Input0.outputChannels)
                }
                """,
            )
        ]

        self.category = PYTORCH
        self.name = "Upscale Image"
        self.icon = "PyTorch"
        self.sub = "Processing"

    def upscale(self, img: np.ndarray, model: torch.nn.Module, scale: int):
        with torch.no_grad():
            # Borrowed from iNNfer
            logger.info("Converting image to tensor")
            img_tensor = np2tensor(img, change_range=True)
            logger.info("Upscaling image")

            if os.environ["device"] == "cuda":
                GB_AMT = 1024**3
                free, total = torch.cuda.mem_get_info(0)  # type: ignore
                img_bytes = img_tensor.numel() * img_tensor.element_size()
                model_bytes = sum(
                    p.numel() * p.element_size() for p in model.parameters()
                )
                mem_required_estimation = (model_bytes / (1024 * 52)) * img_bytes
                split_estimation = 1
                x = mem_required_estimation
                while x > free:
                    x /= 4
                    split_estimation += 1
                logger.info(
                    f"Estimating memory required: {mem_required_estimation/GB_AMT:.2f} GB, {free/GB_AMT:.2f} GB free, {total/GB_AMT:.2f} GB total. Estimated Split depth: {split_estimation}"
                )

            t_out, depth = auto_split_process(
                img_tensor,
                model,
                scale,
            )
            if os.environ["device"] == "cuda":
                logger.info(f"Actual Split depth: {depth}")
            del img_tensor, model
            logger.info("Converting tensor to image")
            img_out = tensor2np(t_out.detach(), change_range=False, imtype=np.float32)
            logger.info("Done upscaling")
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            del t_out
            return img_out

    def run(self, model: PyTorchModel, img: np.ndarray) -> np.ndarray:
        """Upscales an image with a pretrained model"""

        check_env()

        logger.info(f"Upscaling image...")

        # TODO: Have all super resolution models inherit from something that forces them to use in_nc and out_nc
        in_nc = model.in_nc
        out_nc = model.out_nc
        scale = model.scale
        h, w, c = get_h_w_c(img)
        logger.info(
            f"Upscaling a {h}x{w}x{c} image with a {scale}x model (in_nc: {in_nc}, out_nc: {out_nc})"
        )

        return convenient_upscale(
            img,
            in_nc,
            lambda i: self.upscale(i, model, model.scale),
        )


@NodeFactory.register("chainner:pytorch:interpolate_models")
class InterpolateNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Interpolate two of the same kind of model state-dict
             together. Note: models must share a common 'pretrained model' ancestor
             in order to be interpolatable."""
        self.inputs = [
            ModelInput("Model A"),
            ModelInput("Model B"),
            SliderInput(
                "Weights",
                controls_step=5,
                slider_step=1,
                maximum=100,
                default=50,
                unit="%",
                note_expression="`Model A ${100 - value}% ― Model B ${value}%`",
                ends=("A", "B"),
            ),
        ]
        self.outputs = [
            ModelOutput(model_type="Input0 & Input1").with_never_reason(
                "Models must be of the same type and have the same parameters to be interpolated."
            ),
            NumberOutput("Amount A", "subtract(100, Input2)"),
            NumberOutput("Amount B", "Input2"),
        ]

        self.category = PYTORCH
        self.name = "Interpolate Models"
        self.icon = "BsTornado"
        self.sub = "Utility"

    def perform_interp(self, model_a: OrderedDict, model_b: OrderedDict, amount: int):
        try:
            amount_b = amount / 100
            amount_a = 1 - amount_b

            state_dict = OrderedDict()
            for k, v_1 in model_a.items():
                v_2 = model_b[k]
                state_dict[k] = (amount_a * v_1) + (amount_b * v_2)
            return state_dict
        except:
            # pylint: disable=raise-missing-from
            raise ValueError(
                "These models are not compatible and able not able to be interpolated together"
            )

    def check_can_interp(self, model_a: OrderedDict, model_b: OrderedDict):
        a_keys = model_a.keys()
        b_keys = model_b.keys()
        if a_keys != b_keys:
            return False
        interp_50 = self.perform_interp(model_a, model_b, 50)
        model = load_state_dict(interp_50).cpu()
        fake_img = np.ones((3, 3, model.in_nc), dtype=np.float32)
        del interp_50
        with torch.no_grad():
            img_tensor = np2tensor(fake_img, change_range=True).cpu()
            t_out = model(img_tensor)
            result = tensor2np(t_out.detach(), change_range=False, imtype=np.float32)
        del model, img_tensor, t_out, fake_img
        mean_color = np.mean(result)
        del result
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        return mean_color > 0.5

    def run(self, model_a: PyTorchModel, model_b: PyTorchModel, amount: int) -> Any:

        state_a = model_a.state
        state_b = model_b.state

        logger.info(f"Interpolating models...")
        if not self.check_can_interp(state_a, state_b):
            raise ValueError(
                "These models are not compatible and not able to be interpolated together"
            )

        state_dict = self.perform_interp(state_a, state_b, amount)
        model = load_state_dict(state_dict)

        return model, 100 - amount, amount


@NodeFactory.register("chainner:pytorch:save_model")
class PthSaveNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Save a PyTorch model to specified directory."
        self.inputs = [ModelInput(), DirectoryInput(), TextInput("Model Name")]
        self.outputs = []

        self.category = PYTORCH
        self.name = "Save Model"
        self.icon = "MdSave"
        self.sub = "Input & Output"

        self.side_effects = True

    def run(self, model: PyTorchModel, directory: str, name: str) -> None:
        full_file = f"{name}.pth"
        full_path = os.path.join(directory, full_file)
        logger.info(f"Writing model to path: {full_path}")
        torch.save(model.state, full_path)


# @NodeFactory.register("PyTorch", "JIT Trace")
# class JitTraceNode(NodeBase):
#     def __init__(self):
#         super().__init__()
#         self.description = "JIT trace a pytorch model"
#         self.inputs = [ModelInput(), ImageInput("Example Input")]
#         self.outputs = [TorchScriptOutput()]

#         self.icon = "PyTorch"
#         self.sub = "JIT"

#     def run(self, model: any, image: np.ndarray) -> torch.ScriptModule:
#         tensor = np2tensor(image)
#         if os.environ["device"] == "cuda":
#             model = model.cuda()
#             tensor = tensor.cuda()
#         traced = torch.jit.trace(model, tensor)

#         return traced


# @NodeFactory.register("PyTorch", "JIT::Optimize")
# class JitOptimizeNode(NodeBase):
#     def __init__(self):
##         self.description = "Optimize a JIT traced pytorch model for inference"
#         self.inputs = [TorchScriptInput()]
#         self.outputs = [TorchScriptOutput()]

#     def run(self, model: torch.ScriptModule) -> torch.ScriptModule:
#         optimized = torch.jit.optimize_for_inference(model)

#         return optimized


# @NodeFactory.register("PyTorch", "JIT Save")
# class JitSaveNode(NodeBase):
#     def __init__(self):
#         super().__init__()
#         self.description = "Save a JIT traced pytorch model to a file"
#         self.inputs = [TorchScriptInput(), DirectoryInput(), TextInput("Model Name")]
#         self.outputs = []

#         self.icon = "PyTorch"
#         self.sub = "JIT"

#     def run(self, model: torch.ScriptModule, directory: str, name: str):
#         fullFile = f"{name}.pt"
#         fullPath = os.path.join(directory, fullFile)
#         logger.info(f"Writing model to path: {fullPath}")
#         torch.jit.save(model, fullPath)


# @NodeFactory.register("PyTorch", "JIT Load")
# class JitLoadNode(NodeBase):
#     def __init__(self):
#         super().__init__()
#         self.description = "Load a JIT traced pytorch model from a file"
#         self.inputs = [TorchFileInput()]
#         self.outputs = [TorchScriptOutput()]

#         self.icon = "PyTorch"
#         self.sub = "JIT"

#     def run(self, path: str) -> torch.ScriptModule:
#         model = torch.jit.load(path, map_location=torch.device(os.environ["device"]))

#         return model


# @NodeFactory.register("PyTorch", "JIT Run")
# class JitRunNode(NodeBase):
#     def __init__(self):
#         super().__init__()
#         self.description = "Run a JIT traced pytorch model"
#         self.inputs = [TorchScriptInput(), ImageInput()]
#         self.outputs = [ImageOutput()]

#         self.icon = "PyTorch"
#         self.sub = "JIT"

#     def run(self, model: torch.ScriptModule, image: np.ndarray) -> np.ndarray:
#         tensor = np2tensor(image)
#         if os.environ["device"] == "cuda":
#             model = model.cuda()
#             tensor = tensor.cuda()
#         out = model(tensor)

#         return out


@NodeFactory.register("chainner:pytorch:convert_to_onnx")
class ConvertTorchToONNXNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Convert a PyTorch model to ONNX.
            Can be used to convert to NCNN outside chaiNNer, or used to run the model via ONNX."""
        self.inputs = [ModelInput("PyTorch Model")]
        self.outputs = [OnnxModelOutput("ONNX Model")]

        self.category = PYTORCH
        self.name = "Convert To ONNX"
        self.icon = "ONNX"
        self.sub = "Utility"

    def run(self, model: torch.nn.Module) -> bytes:
        model = model.eval()
        if os.environ["device"] == "cuda":
            model = model.cuda()
        # https://github.com/onnx/onnx/issues/654
        dynamic_axes = {
            "data": {0: "batch_size", 2: "width", 3: "height"},
            "output": {0: "batch_size", 2: "width", 3: "height"},
        }
        dummy_input = torch.rand(1, model.in_nc, 64, 64)  # type: ignore
        if os.environ["device"] == "cuda":
            dummy_input = dummy_input.cuda()

        with BytesIO() as f:
            torch.onnx.export(
                model,
                dummy_input,
                f,
                opset_version=14,
                verbose=False,
                input_names=["data"],
                output_names=["output"],
                dynamic_axes=dynamic_axes,
            )
            f.seek(0)
            onnx_model_bytes = f.read()

        return onnx_model_bytes


@NodeFactory.register("chainner:pytorch:model_dim")
class GetModelDimensions(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Returns the scale of a PyTorch model."""
        self.inputs = [ModelInput()]
        self.outputs = [NumberOutput("Scale", output_type="Input0.scale")]

        self.category = PYTORCH
        self.name = "Get Model Scale"
        self.icon = "BsRulers"
        self.sub = "Utility"

    def run(self, model: PyTorchModel) -> int:
        return model.scale
