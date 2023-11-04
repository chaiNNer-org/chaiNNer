from __future__ import annotations

import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from enum import Enum

import requests
from sanic.log import logger

STABLE_DIFFUSION_TEXT2IMG_PATH = "/sdapi/v1/txt2img"
STABLE_DIFFUSION_IMG2IMG_PATH = "/sdapi/v1/img2img"
STABLE_DIFFUSION_INTERROGATE_PATH = "/sdapi/v1/interrogate"
STABLE_DIFFUSION_OPTIONS_PATH = "/sdapi/v1/options"
STABLE_DIFFUSION_EXTRA_SINGLE_IMAGE_PATH = "/sdapi/v1/extra-single-image"
STABLE_DIFFUSION_UPSCALERS_PATH = "/sdapi/v1/upscalers"

TIMEOUT_MSG = """Stable diffusion request timeout reached."""

STABLE_DIFFUSION_REQUEST_TIMEOUT = float(
    os.environ.get("STABLE_DIFFUSION_REQUEST_TIMEOUT", None) or "600"
)  # 10 minutes

_thread_pool = ThreadPoolExecutor(max_workers=4)


@dataclass
class Api:
    protocol: str
    host: str
    port: str

    @property
    def base_url(self) -> str:
        return f"{self.protocol}://{self.host}:{self.port}"

    def get_url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def get(self, path: str, timeout: float = STABLE_DIFFUSION_REQUEST_TIMEOUT) -> dict:
        try:
            response = requests.get(self.get_url(path), timeout=timeout)
            if response.status_code != 200:
                raise ExternalServiceHTTPError(
                    f"webui GET request to {path} returned status code: {response.status_code}: {response.text}"
                )
            return response.json()
        except requests.ConnectionError as exc:
            raise ExternalServiceConnectionError(
                f"webui GET request to {path} connection failed"
            ) from exc
        except requests.exceptions.ReadTimeout as exc:
            raise ExternalServiceTimeoutError(TIMEOUT_MSG) from exc

    async def get_async(
        self, path: str, timeout: float = STABLE_DIFFUSION_REQUEST_TIMEOUT
    ) -> dict:
        def run():
            return self.get(path, timeout)

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(_thread_pool, run)
        return result

    def post(self, path: str, json_data: dict) -> dict:
        try:
            response = requests.post(
                self.get_url(path),
                json=json_data,
                timeout=STABLE_DIFFUSION_REQUEST_TIMEOUT,
            )
            if response.status_code != 200:
                raise ExternalServiceHTTPError(
                    f"webui POST request to {path} returned status code: {response.status_code}: {response.text}"
                )
            return response.json()
        except requests.ConnectionError as exc:
            raise ExternalServiceConnectionError(
                f"webui POST request to {path} connection failed"
            ) from exc
        except requests.exceptions.ReadTimeout as exc:
            raise ExternalServiceTimeoutError(TIMEOUT_MSG) from exc


@dataclass
class ApiConfig:
    protocol: list[str]
    host: str
    port: list[str]

    @staticmethod
    def from_env():
        protocol = os.environ.get("STABLE_DIFFUSION_PROTOCOL", None)
        host = os.environ.get("STABLE_DIFFUSION_HOST", "127.0.0.1")
        port = os.environ.get("STABLE_DIFFUSION_PORT", None)

        protocol = [protocol] if protocol else ["https", "http"]

        port = [port] if port else ["7860", "7861"]

        return ApiConfig(protocol, host, port)

    def list_apis(self) -> list[Api]:
        apis: list[Api] = []
        for protocol in self.protocol:
            for port in self.port:
                apis.append(Api(protocol, self.host, port))  # noqa: PERF401
        return apis


_CURRENT_API: Api | None = None


async def get_verified_api() -> Api | None:
    timeout = 1  # seconds

    global _CURRENT_API  # pylint: disable=global-statement
    if _CURRENT_API is not None:
        # redo check to see if it's still alive
        try:
            await _CURRENT_API.get_async(STABLE_DIFFUSION_OPTIONS_PATH, timeout=timeout)
            return _CURRENT_API
        except Exception:
            _CURRENT_API = None

    # check all apis in parallel
    apis = ApiConfig.from_env().list_apis()
    assert len(apis) > 0
    tasks = [
        api.get_async(STABLE_DIFFUSION_OPTIONS_PATH, timeout=timeout) for api in apis
    ]
    # because good API design just isn't pythonic, asyncio.gather will return List[Any].
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # find the first working api
    for api, result in zip(apis, results):
        if not isinstance(result, Exception):
            logger.info(f"Found stable diffusion API at {api.base_url}")
            _CURRENT_API = api
            return api

    return None


def get_api() -> Api:
    if _CURRENT_API is not None:
        return _CURRENT_API

    api = asyncio.run(get_verified_api())
    if api is None:
        raise RuntimeError("No stable diffusion API found")
    return api


class ExternalServiceHTTPError(Exception):
    pass


class ExternalServiceConnectionError(Exception):
    pass


class ExternalServiceTimeoutError(Exception):
    pass


class UpscalerName(Enum):
    LANCZOS = "Lanczos"
    NEAREST = "Nearest"
    LDSR = "LDSR"
    ESRGAN_4 = "ESRGAN_4x"
    REAL_ESRGAN_4 = "R-ESRGAN 4x+"
    REAL_ESRGAN_4_ANIME6B = "R-ESRGAN 4x+ Anime6B"
    SCUNET_GAN = "ScuNET GAN"
    SCUNET_PSNR = "ScuNET PSNR"
    SWIN_IR_4 = "SwinIR 4x"


UPSCALE_NAME_LABELS = {
    UpscalerName.LANCZOS: "Lanczos",
    UpscalerName.NEAREST: "Nearest",
    UpscalerName.LDSR: "LDSR",
    UpscalerName.ESRGAN_4: "ESRGAN 4x",
    UpscalerName.REAL_ESRGAN_4: "Real ESRGAN 4x+",
    UpscalerName.REAL_ESRGAN_4_ANIME6B: "Real ESRGAN 4x+ Anime6B",
    UpscalerName.SCUNET_GAN: "ScuNET GAN",
    UpscalerName.SCUNET_PSNR: "ScuNET PSNR",
    UpscalerName.SWIN_IR_4: "SwinIR 4x",
}


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
