from __future__ import annotations

import base64
import io
import os
from enum import Enum
from typing import Dict, Union

import cv2
import numpy as np
import requests
from PIL import Image

from .image_utils import normalize
from ..utils.utils import get_h_w_c

STABLE_DIFFUSION_HOST = os.environ.get("STABLE_DIFFUSION_HOST", "127.0.0.1")
STABLE_DIFFUSION_PORT = os.environ.get("STABLE_DIFFUSION_PORT", "7860")

STABLE_DIFFUSION_REQUEST_TIMEOUT = float(
    os.environ.get("STABLE_DIFFUSION_REQUEST_TIMEOUT", "600")
)  # 10 minutes

STABLE_DIFFUSION_TEXT2IMG_URL = (
    f"http://{STABLE_DIFFUSION_HOST}:{STABLE_DIFFUSION_PORT}/sdapi/v1/txt2img"
)
STABLE_DIFFUSION_IMG2IMG_URL = (
    f"http://{STABLE_DIFFUSION_HOST}:{STABLE_DIFFUSION_PORT}/sdapi/v1/img2img"
)
STABLE_DIFFUSION_INTERROGATE_URL = (
    f"http://{STABLE_DIFFUSION_HOST}:{STABLE_DIFFUSION_PORT}/sdapi/v1/interrogate"
)
STABLE_DIFFUSION_OPTIONS_URL = (
    f"http://{STABLE_DIFFUSION_HOST}:{STABLE_DIFFUSION_PORT}/sdapi/v1/options"
)

ERROR_MSG = f"""
If you want to use external stable diffusion nodes, run the Automatic1111 web ui with the --api flag, like so:

./webui.sh --api

ChaiNNer is currently configured to look for the API at http://{STABLE_DIFFUSION_HOST}:{STABLE_DIFFUSION_PORT}.  If you
have it running somewhere else, you can change this using the STABLE_DIFFUSION_HOST and STABLE_DIFFUSION_PORT
environment variables.
"""

TIMEOUT_MSG = f"""
Stable diffusion request timeout reached.  Currently configured as {STABLE_DIFFUSION_REQUEST_TIMEOUT} seconds.  If you
want to change this, set the STABLE_DIFFUSION_REQUEST_TIMEOUT environment variable.
"""


class ExternalServiceConnectionError(Exception):
    pass


class ExternalServiceTimeout(Exception):
    pass


def get(url) -> Dict:
    try:
        response = requests.get(url, timeout=STABLE_DIFFUSION_REQUEST_TIMEOUT)
    except requests.ConnectionError as exc:
        raise ExternalServiceConnectionError(ERROR_MSG) from exc
    except requests.exceptions.ReadTimeout as exc:
        raise ExternalServiceTimeout(TIMEOUT_MSG) from exc
    return response.json()


def post(url, json_data: Dict) -> Dict:
    try:
        response = requests.post(
            url, json=json_data, timeout=STABLE_DIFFUSION_REQUEST_TIMEOUT
        )
    except requests.ConnectionError as exc:
        raise ExternalServiceConnectionError(ERROR_MSG) from exc
    except requests.exceptions.ReadTimeout as exc:
        raise ExternalServiceTimeout(TIMEOUT_MSG) from exc
    return response.json()


def nearest_valid_size(width, height):
    return (width // 8) * 8, (height // 8) * 8


has_api_connection: Union[bool, None] = None


def verify_api_connection():
    """
    This function will throw if the stable diffusion API service is unavailable.

    Call this function at import time if you want to make certain node available only when the API is up.
    """
    global has_api_connection  # pylint: disable=global-statement
    if has_api_connection is None:
        has_api_connection = False
        get(STABLE_DIFFUSION_OPTIONS_URL)
        has_api_connection = True

    if not has_api_connection:
        raise ValueError("Cannot connect to stable diffusion API service.")


def decode_base64_image(image_bytes: Union[bytes, str]) -> np.ndarray:
    image = Image.open(io.BytesIO(base64.b64decode(image_bytes)))
    image_nparray = np.array(image)
    _, _, c = get_h_w_c(image_nparray)
    if c == 3:
        image_nparray = cv2.cvtColor(image_nparray, cv2.COLOR_RGB2BGR)
    elif c == 4:
        image_nparray = cv2.cvtColor(image_nparray, cv2.COLOR_RGBA2BGRA)
    return normalize(image_nparray)


def encode_base64_image(image_nparray: np.ndarray) -> str:
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
    with io.BytesIO() as buffer:
        with Image.fromarray(image_nparray) as image:
            image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")


class SamplerName(Enum):
    EULER = "Euler"
    EULER_A = "Euler a"
    LMS = "LMS"
    HEUN = "Heun"
    DPM2 = "DPM2"
    DPM2_A = "DPM2 a"
    DPMpp_2S_A = "DPM++ 2S a"
    DPMpp_2M = "DPM++ 2M"
    DPMpp_SDE = "DPM++ SDE"
    DPM_FAST = "DPM fast"
    DPM_A = "DPM adaptive"
    LMS_KARRAS = "LMS Karras"
    DPM2_KARRAS = "DPM2 Karras"
    DPM2_A_KARRAS = "DPM2 a Karras"
    DPMpp_2S_A_KARRAS = "DPM++ 2S a Karras"
    DPMpp_2M_KARRAS = "DPM++ 2M Karras"
    DPMpp_SDE_KARRAS = "DPM++ SDE Karras"
    DDIM = "DDIM"
    PLMS = "PLMS"


SAMPLER_NAME_LABELS = {
    SamplerName.EULER: "Euler",
    SamplerName.EULER_A: "Euler a",
    SamplerName.LMS: "LMS",
    SamplerName.HEUN: "Heun",
    SamplerName.DPM2: "DPM2",
    SamplerName.DPM2_A: "DPM2 a",
    SamplerName.DPMpp_2S_A: "DPM++ 2S a",
    SamplerName.DPMpp_2M: "DPM++ 2M",
    SamplerName.DPMpp_SDE: "DPM++ SDE",
    SamplerName.DPM_FAST: "DPM fast",
    SamplerName.DPM_A: "DPM adaptive",
    SamplerName.LMS_KARRAS: "LMS Karras",
    SamplerName.DPM2_KARRAS: "DPM2 Karras",
    SamplerName.DPM2_A_KARRAS: "DPM2 a Karras",
    SamplerName.DPMpp_2S_A_KARRAS: "DPM++ 2S a Karras",
    SamplerName.DPMpp_2M_KARRAS: "DPM++ 2M Karras",
    SamplerName.DPMpp_SDE_KARRAS: "DPM++ SDE Karras",
    SamplerName.DDIM: "DDIM",
    SamplerName.PLMS: "PLMS",
}


class ResizeMode(Enum):
    JUST_RESIZE = 0
    CROP_AND_RESIZE = 1
    RESIZE_AND_FILL = 2
    LATENT_UPSCALE = 3


RESIZE_MODE_LABELS = {
    ResizeMode.JUST_RESIZE: "Just resize",
    ResizeMode.CROP_AND_RESIZE: "Crop and resize",
    ResizeMode.RESIZE_AND_FILL: "Resize and fill",
    ResizeMode.LATENT_UPSCALE: "Just resize (Latent upscale)",
}


class InpaintingFill(Enum):
    FILL = 0
    ORIGINAL = 1
    LATENT_NOISE = 2
    LATENT_NOTHING = 3
