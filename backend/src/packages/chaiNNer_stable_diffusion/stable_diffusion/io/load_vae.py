from __future__ import annotations

import os
from typing import Tuple

from nodes.impl.stable_diffusion import VAEModel
from nodes.properties.inputs import StableDiffusionPtFileInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput
from nodes.properties.outputs.stable_diffusion_outputs import VAEModelOutput
from nodes.utils.utils import split_file_path

from .. import io_group


@io_group.register(
    "chainner:stable_diffusion:load_vae",
    name="Load VAE",
    description="",
    icon="MdAutoAwesome",
    inputs=[StableDiffusionPtFileInput(primary_input=True)],
    outputs=[
        VAEModelOutput(),
        DirectoryOutput("Model Directory", of_input=0),
        FileNameOutput("Model Name", of_input=0),
    ],
)
def load_vae(path: str) -> Tuple[VAEModel, str, str]:
    assert os.path.exists(path), f"Model file at location {path} does not exist"
    assert os.path.isfile(path), f"Path {path} is not a file"

    vae = VAEModel.from_model(path)

    dirname, basename, _ = split_file_path(path)
    return vae, dirname, basename
