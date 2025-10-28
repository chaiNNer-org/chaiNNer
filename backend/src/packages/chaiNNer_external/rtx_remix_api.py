from __future__ import annotations

import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any

import requests

from logger import logger

# RTX Remix REST API endpoints
RTX_REMIX_HEALTH_PATH = "/health"
RTX_REMIX_TEXTURES_PATH = "/textures"
RTX_REMIX_MATERIALS_PATH = "/materials"
RTX_REMIX_LIGHTS_PATH = "/lights"
RTX_REMIX_MESHES_PATH = "/meshes"
RTX_REMIX_SCENE_PATH = "/scene"

TIMEOUT_MSG = """RTX Remix request timeout reached."""

RTX_REMIX_REQUEST_TIMEOUT = float(
    os.environ.get("RTX_REMIX_REQUEST_TIMEOUT", None) or "30"
)  # 30 seconds

_thread_pool = ThreadPoolExecutor(max_workers=4)


@dataclass
class RemixApi:
    protocol: str
    host: str
    port: str

    @property
    def base_url(self) -> str:
        return f"{self.protocol}://{self.host}:{self.port}"

    def get_url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def get(
        self, path: str, timeout: float = RTX_REMIX_REQUEST_TIMEOUT
    ) -> dict[str, Any]:
        try:
            response = requests.get(self.get_url(path), timeout=timeout)
            if response.status_code != 200:
                raise ExternalServiceHTTPError(
                    f"RTX Remix GET request to {path} returned status code: {response.status_code}: {response.text}"
                )
            return response.json()
        except requests.ConnectionError as exc:
            raise ExternalServiceConnectionError(
                f"RTX Remix GET request to {path} connection failed"
            ) from exc
        except requests.exceptions.ReadTimeout as exc:
            raise ExternalServiceTimeoutError(TIMEOUT_MSG) from exc

    async def get_async(
        self, path: str, timeout: float = RTX_REMIX_REQUEST_TIMEOUT
    ) -> dict[str, Any]:
        def run():
            return self.get(path, timeout)

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(_thread_pool, run)
        return result

    def post(self, path: str, json_data: dict[str, Any]) -> dict[str, Any]:
        try:
            response = requests.post(
                self.get_url(path),
                json=json_data,
                timeout=RTX_REMIX_REQUEST_TIMEOUT,
            )
            if response.status_code != 200:
                raise ExternalServiceHTTPError(
                    f"RTX Remix POST request to {path} returned status code: {response.status_code}: {response.text}"
                )
            return response.json()
        except requests.ConnectionError as exc:
            raise ExternalServiceConnectionError(
                f"RTX Remix POST request to {path} connection failed"
            ) from exc
        except requests.exceptions.ReadTimeout as exc:
            raise ExternalServiceTimeoutError(TIMEOUT_MSG) from exc

    def put(self, path: str, json_data: dict[str, Any]) -> dict[str, Any]:
        try:
            response = requests.put(
                self.get_url(path),
                json=json_data,
                timeout=RTX_REMIX_REQUEST_TIMEOUT,
            )
            if response.status_code != 200:
                raise ExternalServiceHTTPError(
                    f"RTX Remix PUT request to {path} returned status code: {response.status_code}: {response.text}"
                )
            return response.json()
        except requests.ConnectionError as exc:
            raise ExternalServiceConnectionError(
                f"RTX Remix PUT request to {path} connection failed"
            ) from exc
        except requests.exceptions.ReadTimeout as exc:
            raise ExternalServiceTimeoutError(TIMEOUT_MSG) from exc


@dataclass
class RemixApiConfig:
    protocol: list[str]
    host: str
    port: list[str]

    @staticmethod
    def from_env():
        protocol = os.environ.get("RTX_REMIX_PROTOCOL", None)
        host = os.environ.get("RTX_REMIX_HOST", "127.0.0.1")
        port = os.environ.get("RTX_REMIX_PORT", None)

        if protocol:
            protocol = [protocol]
        else:
            protocol = ["http", "https"]

        if port:
            port = [port]
        else:
            port = ["8111"]

        return RemixApiConfig(protocol, host, port)

    def list_apis(self) -> list[RemixApi]:
        apis: list[RemixApi] = []
        for protocol in self.protocol:
            for port in self.port:
                apis.append(RemixApi(protocol, self.host, port))
        return apis


_CURRENT_API: RemixApi | None = None


async def get_verified_api() -> RemixApi | None:
    timeout = 1  # seconds

    global _CURRENT_API
    if _CURRENT_API is not None:
        # redo check to see if it's still alive
        try:
            await _CURRENT_API.get_async(RTX_REMIX_HEALTH_PATH, timeout=timeout)
            return _CURRENT_API
        except Exception:
            _CURRENT_API = None

    # check all apis in parallel
    apis = RemixApiConfig.from_env().list_apis()
    assert len(apis) > 0
    tasks = [api.get_async(RTX_REMIX_HEALTH_PATH, timeout=timeout) for api in apis]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # find the first working api
    for api, result in zip(apis, results, strict=False):
        if not isinstance(result, Exception):
            logger.info("Found RTX Remix API at %s", api.base_url)
            _CURRENT_API = api
            return api

    return None


def get_api() -> RemixApi:
    if _CURRENT_API is not None:
        return _CURRENT_API

    api = asyncio.run(get_verified_api())
    if api is None:
        raise RuntimeError("No RTX Remix API found")
    return api


class ExternalServiceHTTPError(Exception):
    pass


class ExternalServiceConnectionError(Exception):
    pass


class ExternalServiceTimeoutError(Exception):
    pass
