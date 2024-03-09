from __future__ import annotations

import asyncio
import os
import socket
import subprocess
import sys
import threading
import time
from typing import Iterable

import aiohttp
from sanic import HTTPResponse, Request
from sanic.log import logger

from api import Package


def _find_free_port():
    with socket.socket() as s:
        s.bind(("", 0))  # Bind to a free port provided by the host.
        return s.getsockname()[1]  # Return the port number assigned.


def _port_in_use(port: int):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


class _WorkerProcess:
    def __init__(self, flags: list[str]):
        server_file = os.path.join(os.path.dirname(__file__), "server.py")
        python_location = sys.executable

        self._process = subprocess.Popen(
            [python_location, server_file, *flags],
            shell=False,
            stdin=None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        self._stop_event = threading.Event()

        # Create a separate thread to read and print the output of the subprocess
        threading.Thread(
            target=self._read_output,
            daemon=True,
            name="output reader",
        ).start()

    def close(self):
        self._stop_event.set()
        self._process.terminate()
        self._process.kill()

    def _read_output(self):
        if self._process.stdout is None:
            return
        for line in self._process.stdout:
            if self._stop_event.is_set():
                break
            stripped_line = line.decode().strip()
            words = stripped_line.split()
            log_level = words[4].lower()[1:-1]  # remove brackets
            rest = " ".join(words[5:])
            if log_level == "debug":
                logger.debug(rest)
            elif log_level == "info":
                logger.info(rest)
            elif log_level == "warning":
                logger.warning(rest)
            elif log_level == "error":
                logger.error(rest)
            elif log_level == "critical":
                logger.critical(rest)


class WorkerServer:
    def __init__(self):
        self._process = None

        self._port = _find_free_port()
        self._base_url = f"http://127.0.0.1:{self._port}"
        self._session = None

    async def start(self, flags: Iterable[str] = []):
        logger.info("Starting worker process...")
        self._process = _WorkerProcess([str(self._port), *flags])
        self._session = aiohttp.ClientSession(base_url=self._base_url)
        await self.wait_for_ready()
        logger.info("Worker process started")

    async def stop(self):
        if self._process:
            self._process.close()
        if self._session:
            await self._session.close()
        logger.info("Worker process stopped")

    async def restart(self, flags: Iterable[str] = []):
        await self.stop()
        await self.start(flags)

    async def wait_for_ready(self, timeout: float = 300):
        start = time.time()
        while time.time() - start < timeout:
            if (
                self._process is not None
                and self._session is not None
                and _port_in_use(self._port)
            ):
                try:
                    await self._session.get("/nodes", timeout=5)
                    return
                except Exception:
                    pass

            await asyncio.sleep(0.1)

        raise TimeoutError("Server did not start in time")

    async def proxy_request(self, request: Request, timeout: int | None = 300):
        await self.wait_for_ready()
        assert self._session is not None
        if request.route is None:
            raise ValueError("Route not found")
        async with self._session.request(
            request.method,
            f"/{request.route.path}",
            headers=request.headers,
            data=request.body,
            timeout=timeout,
        ) as resp:
            headers = resp.headers
            status = resp.status
            body = await resp.read()
            return HTTPResponse(
                body,
                status=status,
                headers=dict(headers),
                content_type=request.content_type,
            )

    async def get_sse(self, request: Request):
        await self.wait_for_ready()
        assert self._session is not None
        async with self._session.request(
            request.method,
            "/sse",
            headers=request.headers,
            data=request.body,
            timeout=None,
        ) as resp:
            async for data, _ in resp.content.iter_chunks():
                yield data

    async def get_packages(self):
        await self.wait_for_ready()
        assert self._session is not None
        logger.debug("Fetching packages...")
        packages_resp = await self._session.get(
            "/packages", params={"hideInternal": "false"}
        )
        packages_json = await packages_resp.json()
        packages = [Package.from_dict(p) for p in packages_json]
        return packages
