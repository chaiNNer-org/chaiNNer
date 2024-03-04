from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import threading

import aiohttp
from sanic import HTTPResponse, Request
from sanic.log import logger

from api import Package


class ExecutorServerWorker:
    def __init__(self, port: int, flags: list[str] | None = None):
        self.process = None
        self.stop_event = threading.Event()
        self.finished_starting = False

        self.port = port
        self.flags = flags or []

    def start_process(self):
        server_file = os.path.join(os.path.dirname(__file__), "server.py")
        python_location = sys.executable
        self.process = subprocess.Popen(
            [python_location, server_file, str(self.port), *self.flags],
            shell=False,
            stdin=None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        # Create a separate thread to read and print the output of the subprocess
        threading.Thread(
            target=self._read_output, daemon=True, name="output reader"
        ).start()

    def stop_process(self):
        if self.process:
            self.stop_event.set()
            self.process.terminate()
            self.process.kill()

    def _read_output(self):
        if self.process is None or self.process.stdout is None:
            return
        for line in self.process.stdout:
            if self.stop_event.is_set():
                break
            if not self.finished_starting:
                if "Starting worker" in line.decode():
                    self.finished_starting = True
            print(line.decode().strip())


class ExecutorServer:
    def __init__(self, port: int, flags: list[str] | None = None):
        self.port = port
        self.flags = flags

        self.server_process = None

        self.base_url = f"http://127.0.0.1:{port}"
        self.session = None

        self.backend_ready = False

    async def start(self, flags: list[str] | None = None):
        del self.server_process
        self.server_process = ExecutorServerWorker(self.port, flags or self.flags)
        self.server_process.start_process()
        self.session = aiohttp.ClientSession(base_url=self.base_url)
        await self.wait_for_server_start()
        await self.session.get("/nodes", timeout=None)
        self.backend_ready = True
        return self

    async def stop(self):
        if self.server_process:
            self.server_process.stop_process()
        if self.session:
            await self.session.close()

    async def restart(self, flags: list[str] | None = None):
        await self.stop()
        await self.start(flags)

    async def wait_for_server_start(self):
        while (
            self.server_process is None
            or self.server_process.finished_starting is False
        ):
            await asyncio.sleep(0.1)

    async def wait_for_backend_ready(self):
        while not self.backend_ready:
            await asyncio.sleep(0.1)

    async def proxy_request(self, request: Request, timeout: int | None = 300):
        assert self.session is not None
        await self.wait_for_server_start()
        await self.wait_for_backend_ready()
        if request.route is None:
            raise ValueError("Route not found")
        async with self.session.request(
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
        assert self.session is not None
        await self.wait_for_server_start()
        await self.wait_for_backend_ready()
        async with self.session.request(
            request.method,
            "/sse",
            headers=request.headers,
            data=request.body,
            timeout=None,
        ) as resp:
            async for data, _ in resp.content.iter_chunks():
                yield data

    async def get_packages(self):
        await self.wait_for_server_start()
        await self.wait_for_backend_ready()
        assert self.session is not None
        logger.debug("Fetching packages...")
        packages_resp = await self.session.get(
            "/packages", params={"hideInternal": "false"}
        )
        packages_json = await packages_resp.json()
        packages = [Package.from_dict(p) for p in packages_json]
        return packages
