import base64
import cv2
import io
import numpy as np
import os
import aiohttp
from PIL import Image
from enum import Enum
from typing import Dict, Union
from sanic.log import logger

from .image_utils import normalize
from ..utils.utils import get_h_w_c

STABLE_DIFFUSION_HOST = os.environ.get("STABLE_DIFFUSION_HOST", "127.0.0.1")
STABLE_DIFFUSION_PORT = os.environ.get("STABLE_DIFFUSION_PORT", "7860")
STABLE_DIFFUSION_TEXT2IMG_URL    = f"http://{STABLE_DIFFUSION_HOST}:{STABLE_DIFFUSION_PORT}/sdapi/v1/txt2img"
STABLE_DIFFUSION_IMG2IMG_URL     = f"http://{STABLE_DIFFUSION_HOST}:{STABLE_DIFFUSION_PORT}/sdapi/v1/img2img"
STABLE_DIFFUSION_INTERROGATE_URL = f"http://{STABLE_DIFFUSION_HOST}:{STABLE_DIFFUSION_PORT}/sdapi/v1/interrogate"


async def post_async(url, json_data: Dict) -> Dict:
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=json_data) as response:
            return await response.json()


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
    _,_,c = get_h_w_c(image_nparray)
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
        return base64.b64encode(buffer.getvalue()).decode('utf-8')


class SamplerName(Enum):
    EULER = "Euler"
    EULER_A = "Euler a"
    LMS = "LMS"
    HEUN = "Heun"
    DPM2 = "DPM2"
    DPM2_A = "DPM2 a"
    DPMpp_2S_A = 'DPM++ 2S a'
    DPMpp_2M = 'DPM++ 2M'
    DPMpp_SDE = 'DPM++ SDE'
    DPM_FAST = 'DPM fast'
    DPM_A = 'DPM adaptive'
    LMS_KARRAS = 'LMS Karras'
    DPM2_KARRAS = 'DPM2 Karras'
    DPM2_A_KARRAS = 'DPM2 a Karras'
    DPMpp_2S_A_KARRAS = 'DPM++ 2S a Karras'
    DPMpp_2M_KARRAS = 'DPM++ 2M Karras'
    DPMpp_SDE_KARRAS = 'DPM++ SDE Karras'
    DDIM = 'DDIM'
    PLMS = 'PLMS'
