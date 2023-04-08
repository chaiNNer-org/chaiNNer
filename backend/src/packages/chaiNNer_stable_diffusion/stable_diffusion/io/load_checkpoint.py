from __future__ import annotations

import os
from typing import Tuple

from nodes.impl.stable_diffusion import (
    CLIPModel,
    StableDiffusionModel,
    VAEModel,
    load_checkpoint as _load_checkpoint,
)
from nodes.properties.inputs import CkptFileInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput
from nodes.properties.outputs.stable_diffusion_outputs import (
    CLIPModelOutput,
    StableDiffusionModelOutput,
    VAEModelOutput,
)
from nodes.utils.utils import split_file_path

from .. import io_group


@io_group.register(
    "chainner:stable_diffusion:load_checkpoint",
    name="Load Checkpoint",
    description="",
    icon="MdAutoAwesome",
    inputs=[CkptFileInput(primary_input=True)],
    outputs=[
        StableDiffusionModelOutput(),
        CLIPModelOutput(),
        VAEModelOutput(),
        DirectoryOutput("Model Directory", of_input=0),
        FileNameOutput("Model Name", of_input=0),
    ],
)
def load_checkpoint(
    path: str,
) -> Tuple[StableDiffusionModel, CLIPModel, VAEModel, str, str]:
    assert os.path.exists(path), f"Model file at location {path} does not exist"
    assert os.path.isfile(path), f"Path {path} is not a file"

    sd, clip, vae = _load_checkpoint(checkpoint_filepath=path, embedding_directory=None)

    dirname, basename, _ = split_file_path(path)
    return sd, clip, vae, dirname, basename
