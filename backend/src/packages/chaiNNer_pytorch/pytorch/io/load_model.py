from __future__ import annotations

import os
from typing import Tuple

import torch
from sanic.log import logger

from nodes.impl.pytorch.model_loading import load_state_dict
from nodes.impl.pytorch.types import PyTorchModel
from nodes.impl.pytorch.utils import get_pytorch_device
from nodes.properties.inputs import PthFileInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput, ModelOutput
from nodes.utils.unpickler import RestrictedUnpickle
from nodes.utils.utils import split_file_path

from ... import get_pytorch_settings
from .. import io_group


@io_group.register(
    schema_id="chainner:pytorch:load_model",
    name="Load Model",
    description=[
        "Load PyTorch state dict (.pth) or TorchScript (.pt) file into an auto-detected supported model architecture.",
        "- For Super-Resolution, we support most variations of the RRDB architecture (ESRGAN, Real-ESRGAN, RealSR, BSRGAN, SPSR), Real-ESRGAN's SRVGG architecture, Swift-SRGAN, SwinIR, Swin2SR, HAT, and Omni-SR.",
        "- For Face-Restoration, we support GFPGAN (1.2, 1.3, 1.4), RestoreFormer, and CodeFormer.",
        "- For Inpainting, we support LaMa and MAT.",
        "Links to the official models can be found in [chaiNNer's README](https://github.com/chaiNNer-org/chaiNNer#pytorch), and community-trained models on [OpenModelDB](https://openmodeldb.info/).",
    ],
    icon="PyTorch",
    inputs=[PthFileInput(primary_input=True)],
    outputs=[
        ModelOutput(kind="tagged"),
        DirectoryOutput("Model Directory", of_input=0).with_id(2),
        FileNameOutput("Model Name", of_input=0).with_id(1),
    ],
    see_also=[
        "chainner:pytorch:model_file_iterator",
    ],
)
def load_model_node(path: str) -> Tuple[PyTorchModel, str, str]:
    """Read a pth file from the specified path and return it as a state dict
    and loaded model after finding arch config"""

    assert os.path.exists(path), f"Model file at location {path} does not exist"

    assert os.path.isfile(path), f"Path {path} is not a file"

    exec_options = get_pytorch_settings()
    pytorch_device = get_pytorch_device(
        exec_options.get("cpu_mode", False), exec_options.get("gpu", 0)
    )
    logger.info(f"Execution options: {exec_options}")

    try:
        logger.debug(f"Reading state dict from path: {path}")

        if os.path.splitext(path)[1].lower() == ".pt":
            state_dict = torch.jit.load(  # type: ignore
                path, map_location=pytorch_device
            ).state_dict()
        else:
            state_dict = torch.load(
                path,
                map_location=pytorch_device,
                pickle_module=RestrictedUnpickle,  # type: ignore
            )

        model = load_state_dict(state_dict)

        for _, v in model.named_parameters():
            v.requires_grad = False
        model.eval()
        model = model.to(pytorch_device)
        if not hasattr(model, "supports_fp16"):
            model.supports_fp16 = False  # type: ignore
        should_use_fp16 = exec_options.get("fp16_mode", False) and model.supports_fp16
        if should_use_fp16:
            model = model.half()
        else:
            model = model.float()
    except Exception as e:
        raise ValueError(
            f"Model {os.path.basename(path)} is unsupported by chaiNNer. Please try another."
        ) from e

    dirname, basename, _ = split_file_path(path)
    return model, dirname, basename
