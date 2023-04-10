from __future__ import annotations

from comfy.clip import CLIPModel
from comfy.conditioning import Conditioning
from comfy.latent_image import (
    CropMethod,
    GreyscaleImage,
    LatentImage,
    RGBImage,
    UpscaleMethod,
)
from comfy.stable_diffusion import (
    BuiltInCheckpointConfigName,
    CheckpointConfig,
    Sampler,
    Scheduler,
    StableDiffusionModel,
    load_checkpoint,
)
from comfy.vae import VAEModel

from nodes.impl.pytorch.utils import to_pytorch_execution_options
from nodes.utils.exec_options import get_execution_options

exec_options = to_pytorch_execution_options(get_execution_options())

__all__ = [
    "CLIPModel",
    "Conditioning",
    "CropMethod",
    "LatentImage",
    "UpscaleMethod",
    "BuiltInCheckpointConfigName",
    "CheckpointConfig",
    "Sampler",
    "Scheduler",
    "StableDiffusionModel",
    "load_checkpoint",
    "VAEModel",
    "RGBImage",
    "GreyscaleImage",
    "exec_options",
]
