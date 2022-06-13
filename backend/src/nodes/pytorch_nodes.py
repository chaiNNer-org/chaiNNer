"""
Nodes that provide functionality for pytorch inference
"""


import os
from typing import Any, OrderedDict

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
from .utils.utils import get_h_w_c, np2tensor, tensor2np


def check_env():
    os.environ["device"] = (
        "cuda" if torch.cuda.is_available() and os.environ["device"] != "cpu" else "cpu"
    )

    if os.environ["isFp16"] == "True":
        if os.environ["device"] == "cpu":
            os.environ["isFp16"] = "False"
            torch.set_default_tensor_type(torch.FloatTensor)
        elif os.environ["device"] == "cuda":
            torch.set_default_tensor_type(torch.cuda.HalfTensor)  # type: ignore
        else:
            logger.warning("Something isn't set right with the device env var")


def load_state_dict(state_dict):
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
    """Load Model node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = """Load PyTorch state dict file (.pth) into an auto-detected supported model architecture.
            Supports most variations of the RRDB architecture
            (ESRGAN, Real-ESRGAN, RealSR, BSRGAN, SPSR),
            Real-ESRGAN's SRVGG architecture, and Swift-SRGAN."""
        self.inputs = [PthFileInput()]
        self.outputs = [ModelOutput(), TextOutput("Model Name")]

        self.category = PYTORCH
        self.name = "Load Model"
        self.icon = "PyTorch"
        self.sub = "Input & Output"

        # Defined in run
        self.model = None
        self.basename = None

    def get_extra_data(self) -> Dict:
        # TODO: Figure out how to make types for this
        if "SRVGG" in self.model.model_type:  # type: ignore
            size = [f"{self.model.num_feat}nf", f"{self.model.num_conv}nc"]  # type: ignore
        else:
            size = [
                f"{self.model.num_filters}nf",  # type: ignore
                f"{self.model.num_blocks}nb",  # type: ignore
            ]

        return {
            "modelType": self.model.model_type,  # type: ignore
            "inNc": self.model.in_nc,  # type: ignore
            "outNc": self.model.out_nc,  # type: ignore
            "size": size,
            "scale": self.model.scale,  # type: ignore
            "name": self.basename,
        }

    def run(self, path: str) -> Any:
        """Read a pth file from the specified path and return it as a state dict
        and loaded model after finding arch config"""

        assert os.path.exists(path), f"Model file at location {path} does not exist"

        assert os.path.isfile(path), f"Path {path} is not a file"

        check_env()

        logger.info(f"Reading state dict from path: {path}")
        state_dict = torch.load(path, map_location=torch.device(os.environ["device"]))

        self.model = load_state_dict(state_dict)

        for _, v in self.model.named_parameters():
            v.requires_grad = False
        self.model.eval()
        self.model = self.model.to(torch.device(os.environ["device"]))

        self.basename = os.path.splitext(os.path.basename(path))[0]

        return self.model, self.basename


@NodeFactory.register("chainner:pytorch:upscale_image")
@torch.inference_mode()
class ImageUpscaleNode(NodeBase):
    """Image Upscale node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Upscales an image using a PyTorch Super-Resolution model."
        self.inputs = [ModelInput(), ImageInput()]
        self.outputs = [
            ImageOutput(
                "Upscaled Image",
                expression.Image(
                    width=expression.fn(
                        "multiply",
                        expression.field("Input0", "scale"),
                        expression.field("Input1", "width"),
                    ),
                    height=expression.fn(
                        "multiply",
                        expression.field("Input0", "scale"),
                        expression.field("Input1", "height"),
                    ),
                    channels=expression.field("Input0", "outputChannels"),
                ),
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
            if os.environ["isFp16"] == "True":
                model = model.half()
                img_tensor = img_tensor.half()
            logger.info("Upscaling image")
            t_out, _ = auto_split_process(
                img_tensor,
                model,
                scale,
            )
            del img_tensor, model
            logger.info("Converting tensor to image")
            img_out = tensor2np(t_out.detach(), change_range=False, imtype=np.float32)
            logger.info("Done upscaling")
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            del t_out
            return img_out

    def run(self, model: torch.nn.Module, img: np.ndarray) -> np.ndarray:
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

        # Ensure correct amount of image channels for the model.
        # The frontend should type-validate this enough where it shouldn't be needed,
        # But I want to be extra safe

        # Transparency hack (white/black background difference alpha)
        if in_nc == 3 and c == 4:
            # Ignore single-color alpha
            unique = np.unique(img[:, :, 3])
            if len(unique) == 1:
                logger.info("Single color alpha channel, ignoring.")
                output = self.upscale(img[:, :, :3], model, model.scale)  # type: ignore
                output = np.dstack((output, np.full(output.shape[:-1], unique[0])))
            else:
                img1 = np.copy(img[:, :, :3])
                img2 = np.copy(img[:, :, :3])
                for c in range(3):
                    img1[:, :, c] *= img[:, :, 3]
                    img2[:, :, c] = (img2[:, :, c] - 1) * img[:, :, 3] + 1

                output1 = self.upscale(img1, model, model.scale)  # type: ignore
                output2 = self.upscale(img2, model, model.scale)  # type: ignore
                alpha = 1 - np.mean(output2 - output1, axis=2)  # type: ignore
                output = np.dstack((output1, alpha))
        else:
            # Add extra channels if not enough (i.e single channel img, three channel model)
            gray = False
            if img.ndim == 2:
                gray = True
                logger.debug("Expanding image channels")
                img = np.tile(np.expand_dims(img, axis=2), (1, 1, min(in_nc, 3)))  # type: ignore
            # Remove extra channels if too many (i.e three channel image, single channel model)
            elif img.shape[2] > in_nc:  # type: ignore
                logger.warning("Truncating image channels")
                img = img[:, :, :in_nc]
            # Pad with solid alpha channel if needed (i.e three channel image, four channel model)
            elif img.shape[2] == 3 and in_nc == 4:
                logger.debug("Expanding image channels")
                img = np.dstack((img, np.full(img.shape[:-1], 1.0)))

            output = self.upscale(img, model, model.scale)  # type: ignore

            if gray:
                output = np.average(output, axis=2).astype("float32")

        output = np.clip(output, 0, 1)

        return output


@NodeFactory.register("chainner:pytorch:interpolate_models")
class InterpolateNode(NodeBase):
    """Interpolate node"""

    def __init__(self):
        """Constructor"""
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
        self.outputs = [ModelOutput()]

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
        model = load_state_dict(interp_50)
        fake_img = np.ones((3, 3, 3), dtype=np.float32)
        del interp_50
        result = ImageUpscaleNode().run(model, fake_img)
        del model
        mean_color = np.mean(result)
        del result
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        return mean_color > 0.5

    def run(
        self, model_a: torch.nn.Module, model_b: torch.nn.Module, amount: int
    ) -> Any:

        state_a = model_a.state
        state_b = model_b.state

        logger.info(f"Interpolating models...")
        if not self.check_can_interp(state_a, state_b):  # type: ignore
            raise ValueError(
                "These models are not compatible and not able to be interpolated together"
            )

        state_dict = self.perform_interp(state_a, state_b, amount)  # type: ignore
        model = load_state_dict(state_dict)

        return model


@NodeFactory.register("chainner:pytorch:save_model")
class PthSaveNode(NodeBase):
    """Model Save node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Save a PyTorch model to specified directory."
        self.inputs = [ModelInput(), DirectoryInput(), TextInput("Model Name")]
        self.outputs = []

        self.category = PYTORCH
        self.name = "Save Model"
        self.icon = "MdSave"
        self.sub = "Input & Output"

        self.side_effects = True

    def run(self, model: torch.nn.Module, directory: str, name: str) -> None:
        full_file = f"{name}.pth"
        full_path = os.path.join(directory, full_file)
        logger.info(f"Writing model to path: {full_path}")
        torch.save(model.state, full_path)


# @NodeFactory.register("PyTorch", "JIT Trace")
# class JitTraceNode(NodeBase):
#     """JIT trace node"""

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
#     """JIT optimize node"""

#     def __init__(self):
#         """Constructor"""
#         self.description = "Optimize a JIT traced pytorch model for inference"
#         self.inputs = [TorchScriptInput()]
#         self.outputs = [TorchScriptOutput()]

#     def run(self, model: torch.ScriptModule) -> torch.ScriptModule:
#         optimized = torch.jit.optimize_for_inference(model)

#         return optimized


# @NodeFactory.register("PyTorch", "JIT Save")
# class JitSaveNode(NodeBase):
#     """JIT save node"""

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
#     """JIT load node"""

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
#     """JIT run node"""

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
    """ONNX node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = """Convert a PyTorch model to ONNX.
            Can be used to convert to NCNN outside chaiNNer, or used to run the model via ONNX."""
        self.inputs = [ModelInput(), DirectoryInput(), TextInput("Model Name")]
        self.outputs = [OnnxFileOutput()]

        self.category = PYTORCH
        self.name = "Convert To ONNX"
        self.icon = "ONNX"
        self.sub = "Utility"

    def run(self, model: torch.nn.Module, directory: str, model_name: str) -> str:
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

        out_filepath = os.path.join(directory, f"{model_name}.onnx")

        torch.onnx.export(
            model,
            dummy_input,
            out_filepath,
            opset_version=14,
            verbose=False,
            input_names=["data"],
            output_names=["output"],
            dynamic_axes=dynamic_axes,
        )

        return out_filepath
