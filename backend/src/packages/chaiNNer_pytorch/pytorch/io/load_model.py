from __future__ import annotations

import os
from pathlib import Path

from sanic.log import logger
from spandrel import ModelDescriptor, ModelLoader

from api import NodeContext
from nodes.properties.inputs import PthFileInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput, ModelOutput
from nodes.utils.utils import split_file_path

from ...settings import get_settings
from .. import io_group


def parse_ckpt_state_dict(checkpoint: dict):
    state_dict = {}
    for i, j in checkpoint.items():
        if "netG." in i:
            key = i.replace("netG.", "")
            state_dict[key] = j
        elif "module." in i:
            key = i.replace("module.", "")
            state_dict[key] = j
    return state_dict


@io_group.register(
    schema_id="chainner:pytorch:load_model",
    name="Load Model",
    description=[
        (
            "Load PyTorch state dict (.pth), TorchScript (.pt), or Checkpoint (.ckpt) files into an"
            " auto-detected supported model architecture."
        ),
        (
            "- For Super-Resolution, we support most variations of the RRDB"
            " architecture (ESRGAN, Real-ESRGAN, RealSR, BSRGAN, SPSR), Real-ESRGAN's"
            " SRVGG architecture, Swift-SRGAN, SwinIR, Swin2SR, HAT, Omni-SR, SRFormer, and DAT."
        ),
        (
            "- For Face-Restoration, we support GFPGAN (1.2, 1.3, 1.4), RestoreFormer,"
            " and CodeFormer."
        ),
        "- For Inpainting, we support LaMa and MAT.",
        (
            "Links to the official models can be found in [chaiNNer's"
            " README](https://github.com/chaiNNer-org/chaiNNer#pytorch), and"
            " community-trained models on [OpenModelDB](https://openmodeldb.info/)."
        ),
    ],
    icon="PyTorch",
    inputs=[PthFileInput(primary_input=True)],
    outputs=[
        ModelOutput(kind="tagged").with_recommended_connections(
            [
                "chainner:pytorch:upscale_image",
            ]
        ),
        DirectoryOutput("Directory", of_input=0).with_id(2),
        FileNameOutput("Name", of_input=0).with_id(1),
    ],
    node_context=True,
    see_also=[
        "chainner:pytorch:load_models",
    ],
)
def load_model_node(
    context: NodeContext, path: Path
) -> tuple[ModelDescriptor, Path, str]:
    assert os.path.exists(path), f"Model file at location {path} does not exist"

    assert os.path.isfile(path), f"Path {path} is not a file"

    exec_options = get_settings(context)
    pytorch_device = exec_options.device

    try:
        logger.debug(f"Reading state dict from path: {path}")

        model_descriptor = ModelLoader(pytorch_device).load_from_file(path)

        for _, v in model_descriptor.model.named_parameters():
            v.requires_grad = False
        model_descriptor.model.eval()
        model_descriptor = model_descriptor.to(pytorch_device)
        should_use_fp16 = exec_options.use_fp16 and model_descriptor.supports_half
        if should_use_fp16:
            model_descriptor.model.half()
        else:
            model_descriptor.model.float()
    except Exception as e:
        raise ValueError(
            f"Model {os.path.basename(path)} is unsupported by chaiNNer. Please try"
            " another."
        ) from e

    dirname, basename, _ = split_file_path(path)
    return model_descriptor, dirname, basename
