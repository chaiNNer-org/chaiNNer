from __future__ import annotations

from typing import Optional

import torch

from nodes.impl.stable_diffusion import CLIPModel, Conditioning
from nodes.properties.inputs import TextAreaInput
from nodes.properties.inputs.stable_diffusion_inputs import CLIPModelInput
from nodes.properties.outputs.stable_diffusion_outputs import ConditioningOutput

from .. import conditioning_group


@conditioning_group.register(
    "chainner:stable_diffusion:clip_encode",
    name="CLIP Encode",
    description="",
    icon="MdAutoAwesome",
    inputs=[
        CLIPModelInput(),
        TextAreaInput("Prompt").make_optional(),
    ],
    outputs=[
        ConditioningOutput(
            model_type="""Conditioning {
            arch: Input0.arch
        }"""
        ),
    ],
)
@torch.no_grad()
def clip_encode(clip: CLIPModel, prompt: Optional[str]) -> Conditioning:
    prompt = prompt or ""
    try:
        clip.cuda()
        out = clip.encode(prompt)
    finally:
        clip.cpu()
    return out.cpu()
