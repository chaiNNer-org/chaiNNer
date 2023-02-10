import hashlib
from enum import Enum
from typing import List, Optional

import cv2
import numpy as np
import sdkit
import torch
from PIL import Image
from sdkit.generate import generate_images
from sdkit.models import load_model

from nodes.utils.utils import get_h_w_c


class InternalSamplerName(Enum):
    DDIM = "ddim"
    PLMS = "plms"
    HEUN = "heun"
    EULER = "euler"
    EULER_A = "euler_a"
    DPM2 = "dpm2"
    DPM2_A = "dpm2_a"
    LMS = "lms"
    dpm_solver_stability = "dpm_solver_stability"
    DPMpp_2S_A = "dpmpp_2s_a"
    DPMpp_2M = "dpmpp_2m"
    DPMpp_SDE = "dpmpp_sde"
    DPM_FAST = "dpm_fast"
    DPM_A = "dpm_adaptive"


def nearest_valid_size(width, height):
    return (width // 64) * 64, (height // 64) * 64


class StableDiffusion:
    def __init__(self, model):
        self.model = model

        hsh = hashlib.sha256()
        hsh.update(self.__class__.__name__.encode("utf-8"))
        state_dict = model.state_dict()
        for key in sorted(state_dict.keys()):
            hsh.update(key.encode("utf-8"))
            hsh.update(state_dict[key].detach().cpu().numpy().tobytes())

        self.cache_hash: bytes = hsh.digest()

    @classmethod
    def from_file(cls, path: str):
        context = sdkit.Context()
        # VRAM usage level "high" disables some clever hooks that load and
        # unload layers from VRAM during processing.  Saves VRAM, but causes
        # some weird errors when we try to move the loaded models out of the
        # sdkit.Context().  (Maybe we don't have to do that though...)
        context.vram_usage_level = "high"
        context.model_paths["stable-diffusion"] = path
        load_model(context, "stable-diffusion")
        return cls(context.models["stable-diffusion"])

    @staticmethod
    def _array_to_image(image_nparray: np.ndarray) -> Image:
        image_nparray = (np.clip(image_nparray, 0, 1) * 255).round().astype("uint8")
        _, _, c = get_h_w_c(image_nparray)
        if c == 1:
            # PIL supports grayscale images just fine, so we don't need to do any conversion
            pass
        elif c == 3:
            image_nparray = cv2.cvtColor(image_nparray, cv2.COLOR_BGR2RGB)
        elif c == 4:
            image_nparray = cv2.cvtColor(image_nparray, cv2.COLOR_BGRA2RGBA)
        else:
            raise RuntimeError
        return Image.fromarray(image_nparray)

    @torch.inference_mode()
    def txt2img(
            self,
            prompt: str,
            negative_prompt: Optional[str],
            seed: int,
            steps: int,
            sampler_name: InternalSamplerName,
            cfg_scale: float,
            width: int,
            height: int,
    ) -> np.ndarray:
        context = sdkit.Context()
        context.vram_usage_level = "high"
        context.models["stable-diffusion"] = self.model

        images: List[Image] = generate_images(
            context=context,
            prompt=prompt,
            negative_prompt=negative_prompt or "",
            seed=seed,
            width=width,
            height=height,
            num_inference_steps=steps,
            guidance_scale=cfg_scale,
            sampler_name=sampler_name.value,
        )
        image = np.array(images[0])

        # TODO RGB/BGR

        return image

    @torch.inference_mode()
    def img2img(
            self,
            prompt: str,
            negative_prompt: Optional[str],
            seed: int,
            steps: int,
            sampler_name: InternalSamplerName,
            cfg_scale: float,
            width: int,
            height: int,
            init_image: Optional[np.ndarray],
            prompt_strength: float,
    ) -> np.ndarray:
        context = sdkit.Context()
        context.vram_usage_level = "high"
        context.models["stable-diffusion"] = self.model

        images: List[Image] = generate_images(
            context=context,
            prompt=prompt,
            negative_prompt=negative_prompt or "",
            seed=seed,
            width=width,
            height=height,
            num_inference_steps=steps,
            guidance_scale=cfg_scale,
            sampler_name=sampler_name.value,
            init_image=self._array_to_image(init_image),
            prompt_strength=prompt_strength,
        )
        image = np.array(images[0])

        # TODO RGB/BGR

        return image
