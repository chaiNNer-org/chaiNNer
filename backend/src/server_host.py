from __future__ import annotations

import asyncio
import logging
import os
import socket
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from json import dumps as stringify

import aiohttp
import psutil
from sanic import Sanic
from sanic.log import access_logger, logger
from sanic.request import Request
from sanic.response import HTTPResponse, json
from sanic_cors import CORS

import api
from api import (
    Package,
)
from custom_types import UpdateProgressFn
from dependencies.store import DependencyInfo, install_dependencies, installed_packages
from events import EventQueue
from gpu import get_nvidia_helper
from server_config import ServerConfig


def find_free_port():
    # return 8001
    with socket.socket() as s:
        s.bind(("", 0))  # Bind to a free port provided by the host.
        return s.getsockname()[1]  # Return the port number assigned.


port = find_free_port()
base_url = f"http://127.0.0.1:{port}"
session = None


class AppContext:
    def __init__(self):
        self.config: ServerConfig = None  # type: ignore
        # This will be initialized by after_server_start.
        # This is necessary because we don't know Sanic's event loop yet.
        self.setup_queue: EventQueue = None  # type: ignore
        self.pool = ThreadPoolExecutor(max_workers=4)

    @staticmethod
    def get(app_instance: Sanic) -> AppContext:
        assert isinstance(app_instance.ctx, AppContext)
        return app_instance.ctx


app = Sanic("chaiNNer_host", ctx=AppContext())
app.config.REQUEST_TIMEOUT = sys.maxsize
app.config.RESPONSE_TIMEOUT = sys.maxsize
CORS(app)


class SSEFilter(logging.Filter):
    def filter(self, record):  # noqa: ANN001
        request = record.request  # type: ignore
        return not (
            (request.endswith(("/sse", "/setup-sse"))) and record.status == 200  # type: ignore
        )


setup_task = None
server_process = None
server_thread = None

access_logger.addFilter(SSEFilter())


async def proxy_request(request: Request, timeout: int = 300):
    assert session is not None
    if request.route is None:
        raise ValueError("Route not found")
    async with session.request(
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


async def get_packages_req():
    assert session is not None
    logger.info("Fetching packages...")
    packages_resp = await session.get("/packages", params={"hideInternal": "false"})
    packages_json = await packages_resp.json()
    packages = [Package.from_dict(p) for p in packages_json]
    return packages


@app.route("/nodes")
async def nodes(request: Request):
    resp = await proxy_request(request)
    return resp


@app.route("/run", methods=["POST"])
async def run(request: Request):
    return await proxy_request(request)


@app.route("/run/individual", methods=["POST"])
async def run_individual(request: Request):
    logger.info("Running individual")
    return await proxy_request(request)


@app.route("/clear-cache/individual", methods=["POST"])
async def clear_cache_individual(request: Request):
    return await proxy_request(request)


@app.route("/pause", methods=["POST"])
async def pause(request: Request):
    return await proxy_request(request)


@app.route("/resume", methods=["POST"])
async def resume(request: Request):
    return await proxy_request(request)


@app.route("/kill", methods=["POST"])
async def kill(request: Request):
    return await proxy_request(request)


@app.route("/python-info", methods=["GET"])
async def python_info(_request: Request):
    version = (
        f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    )
    return json({"python": sys.executable, "version": version})


@dataclass
class SystemStat:
    label: str
    percent: float


@app.route("/system-usage", methods=["GET"])
async def system_usage(_request: Request):
    stats_list = []
    cpu_usage = psutil.cpu_percent()
    mem_usage = psutil.virtual_memory().percent
    stats_list.append(SystemStat("CPU", cpu_usage))
    stats_list.append(SystemStat("RAM", mem_usage))
    nv = get_nvidia_helper()
    if nv is not None:
        for i in range(nv.num_gpus):
            total, used, _ = nv.get_current_vram_usage(i)
            stats_list.append(
                SystemStat(
                    f"VRAM {i}" if nv.num_gpus > 1 else "VRAM",
                    used / total * 100,
                )
            )
    return json([asdict(x) for x in stats_list])


@app.route("/packages", methods=["GET"])
async def get_packages(request: Request):
    return await proxy_request(request)


@app.route("/installed-dependencies", methods=["GET"])
async def get_installed_dependencies(request: Request):
    installed_deps: dict[str, str] = {}
    packages = await get_packages_req()
    for package in packages:
        for pkg_dep in package.dependencies:
            installed_version = installed_packages.get(pkg_dep.pypi_name, None)
            if installed_version is not None:
                installed_deps[pkg_dep.pypi_name] = installed_version

    return json(installed_deps)


@app.route("/features")
async def get_features(request: Request):
    return await proxy_request(request)


@app.get("/sse")
async def sse(request: Request):
    assert session is not None
    headers = {"Cache-Control": "no-cache"}
    response = await request.respond(headers=headers, content_type="text/event-stream")
    async with session.request(
        request.method, "/sse", headers=request.headers, data=request.body, timeout=None
    ) as resp:
        try:
            async for data, _ in resp.content.iter_chunks():
                if response is not None:
                    await response.send(data)
        except Exception as ex:
            logger.error(f"Error in sse: {ex}")


@app.get("/setup-sse")
async def setup_sse(request: Request):
    ctx = AppContext.get(request.app)
    headers = {"Cache-Control": "no-cache"}
    response = await request.respond(headers=headers, content_type="text/event-stream")
    while True:
        message = await ctx.setup_queue.get()
        if response is not None:
            await response.send(f"event: {message['event']}\n")
            await response.send(f"data: {stringify(message['data'])}\n\n")


async def import_packages(
    config: ServerConfig,
    update_progress_cb: UpdateProgressFn,
):
    async def install_deps(dependencies: list[api.Dependency]):
        dep_info: list[DependencyInfo] = [
            {
                "package_name": dep.pypi_name,
                "display_name": dep.display_name,
                "version": dep.version,
                "from_file": None,
            }
            for dep in dependencies
        ]
        await install_dependencies(dep_info, update_progress_cb, logger)

    packages = await get_packages_req()

    logger.info("Checking dependencies...")

    to_install: list[api.Dependency] = []
    for package in packages:
        logger.info(f"Checking dependencies for {package.name}...")

        if config.install_builtin_packages:
            to_install.extend(package.dependencies)
            continue

        if package.name == "chaiNNer_standard":
            to_install.extend(package.dependencies)

        # check auto updates
        for dep in package.dependencies:
            is_installed = installed_packages.get(dep.pypi_name, None) is not None
            if dep.auto_update and is_installed:
                to_install.append(dep)

    if len(to_install) > 0:
        try:
            await install_deps(to_install)

            restart_executor_server()
        except Exception as ex:
            logger.error(f"Error installing dependencies: {ex}")
            if config.close_after_start:
                raise ValueError("Error installing dependencies") from ex

    logger.info("Done checking dependencies...")


async def setup(sanic_app: Sanic, loop: asyncio.AbstractEventLoop):
    setup_queue = AppContext.get(sanic_app).setup_queue

    async def update_progress(
        message: str, progress: float, status_progress: float | None = None
    ):
        await setup_queue.put_and_wait(
            {
                "event": "backend-status",
                "data": {
                    "message": message,
                    "progress": progress,
                    "statusProgress": status_progress,
                },
            },
            timeout=1,
        )

    logger.info("Starting setup...")
    await setup_queue.put_and_wait(
        {
            "event": "backend-started",
            "data": None,
        },
        timeout=1,
    )

    await update_progress("Importing nodes...", 0.0, None)

    logger.info("Importing nodes...")

    # Now we can load all the nodes
    await import_packages(AppContext.get(sanic_app).config, update_progress)

    logger.info("Sending backend ready...")

    await update_progress("Loading Nodes...", 1.0, None)

    # Wait to send backend-ready until nodes are loaded
    assert session is not None
    await session.get("/nodes", timeout=None)

    await setup_queue.put_and_wait(
        {
            "event": "backend-ready",
            "data": None,
        },
        timeout=1,
    )

    logger.info("Done.")


exit_code = 0


async def close_server(sanic_app: Sanic):
    # now we can close the server
    logger.info("Closing server...")
    stop_executor_server()
    sanic_app.stop()
    assert session is not None
    await session.close()


def __run_server():
    global server_process

    server_file = os.path.join(os.path.dirname(__file__), "server.py")
    python_location = sys.executable
    with subprocess.Popen(
        [python_location, server_file, str(port)],
        shell=False,
        stdin=None,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    ) as process:
        server_process = process
        if process.stdout is None:
            return
        for line in process.stdout:
            print(line.decode(), end="")


def start_executor_server():
    global server_thread
    server_thread = threading.Thread(target=__run_server)
    server_thread.start()


def stop_executor_server():
    global server_process, server_thread
    if server_process is not None:
        server_process.kill()
        server_process = None
    if server_thread is not None:
        server_thread.join()
        server_thread = None


def restart_executor_server():
    stop_executor_server()
    start_executor_server()


@app.after_server_start
async def after_server_start(sanic_app: Sanic, loop: asyncio.AbstractEventLoop):
    global session
    session = aiohttp.ClientSession(base_url=base_url)

    # Start the executor server
    loop.run_in_executor(None, start_executor_server)

    # initialize the queues
    ctx = AppContext.get(sanic_app)
    ctx.setup_queue = EventQueue()

    # start the setup task
    loop.create_task(setup(sanic_app, loop))

    # start task to close the server
    if ctx.config.close_after_start:
        loop.create_task(close_server(sanic_app))


def main():
    config = ServerConfig.parse_argv()
    AppContext.get(app).config = config
    app.run(port=config.port, single_process=True)
    if exit_code != 0:
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
