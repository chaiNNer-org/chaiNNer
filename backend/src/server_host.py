from __future__ import annotations

import asyncio
import importlib
import logging
import os
import socket
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from json import dumps as stringify
from typing import Literal, TypedDict

import aiohttp
import psutil
from sanic import Sanic
from sanic.log import access_logger, logger
from sanic.request import Request
from sanic.response import json
from sanic_cors import CORS

import api
from api import (
    JsonExecutionOptions,
    NodeId,
)
from chain.json import JsonNode
from custom_types import UpdateProgressFn
from dependencies.store import DependencyInfo, install_dependencies, installed_packages
from events import EventQueue
from gpu import get_nvidia_helper
from process import ExecutionId, Executor, NodeOutput
from server_config import ServerConfig
from system import is_arm_mac


def find_free_port():
    with socket.socket() as s:
        s.bind(("", 0))  # Bind to a free port provided by the host.
        return s.getsockname()[1]  # Return the port number assigned.


port = find_free_port()
session = None


async def request_server(
    method: Literal["GET", "POST", "PUT", "DELETE"],
    endpoint: str,
    data: dict | None = None,
):
    if session is None:
        raise ValueError("Session not initialized")
    # url = f"http://localhost:{port}/{endpoint}"
    # response = requests.request(method, url, json=data)
    # return response.json()
    url = f"http://localhost:{port}/{endpoint}"
    async with session.request(method, url, json=data) as response:
        return json(await response.json(), status=response.status)


class AppContext:
    def __init__(self):
        self.config: ServerConfig = None  # type: ignore
        self.executor: Executor | None = None
        self.individual_executors: dict[ExecutionId, Executor] = {}
        self.cache: dict[NodeId, NodeOutput] = {}
        # This will be initialized by after_server_start.
        # This is necessary because we don't know Sanic's event loop yet.
        self.queue: EventQueue = None  # type: ignore
        self.setup_queue: EventQueue = None  # type: ignore
        self.pool = ThreadPoolExecutor(max_workers=4)

    @staticmethod
    def get(app_instance: Sanic) -> AppContext:
        assert isinstance(app_instance.ctx, AppContext)
        return app_instance.ctx


app = Sanic("chaiNNer", ctx=AppContext())
app.config.REQUEST_TIMEOUT = sys.maxsize
app.config.RESPONSE_TIMEOUT = sys.maxsize
CORS(app)


class SSEFilter(logging.Filter):
    def filter(self, record):  # noqa: ANN001
        request = record.request  # type: ignore
        return not (
            (request.endswith(("/sse", "/setup-sse"))) and record.status == 200  # type: ignore
        )


class ZeroCounter:
    def __init__(self) -> None:
        self.count = 0

    async def wait_zero(self) -> None:
        while self.count != 0:
            await asyncio.sleep(0.01)

    def __enter__(self):
        self.count += 1

    def __exit__(self, _exc_type: object, _exc_value: object, _exc_traceback: object):
        self.count -= 1


run_individual_counter = ZeroCounter()

setup_task = None
server_process = None


async def nodes_available():
    if setup_task is not None:
        await setup_task


access_logger.addFilter(SSEFilter())


@app.route("/nodes")
async def nodes(request: Request):
    return await request_server("GET", "nodes")


class RunRequest(TypedDict):
    data: list[JsonNode]
    options: JsonExecutionOptions
    sendBroadcastData: bool


@app.route("/run", methods=["POST"])
async def run(request: Request):
    return await request_server("POST", "run", data=request.json)


class RunIndividualRequest(TypedDict):
    id: NodeId
    inputs: list[object]
    schemaId: str
    options: JsonExecutionOptions


@app.route("/run/individual", methods=["POST"])
async def run_individual(request: Request):
    return await request_server("POST", "run/individual", data=request.json)


@app.route("/clear-cache/individual", methods=["POST"])
async def clear_cache_individual(request: Request):
    return await request_server("POST", "clear-cache/individual", data=request.json)


@app.route("/pause", methods=["POST"])
async def pause(request: Request):
    return await request_server("POST", "pause", data=request.json)


@app.route("/resume", methods=["POST"])
async def resume(request: Request):
    return await request_server("POST", "resume", data=request.json)


@app.route("/kill", methods=["POST"])
async def kill(request: Request):
    return await request_server("POST", "kill", data=request.json)


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
async def get_packages(_request: Request):
    return await request_server("GET", "packages")


@app.route("/installed-dependencies", methods=["GET"])
async def get_installed_dependencies(_request: Request):
    return await request_server("GET", "installed-dependencies")


@app.route("/features")
async def get_features(_request: Request):
    return await request_server("GET", "features")


@app.get("/sse")
async def sse(request: Request):
    ctx = AppContext.get(request.app)
    headers = {"Cache-Control": "no-cache"}
    response = await request.respond(headers=headers, content_type="text/event-stream")
    while True:
        message = await ctx.queue.get()
        if response is not None:
            await response.send(f"event: {message['event']}\n")
            await response.send(f"data: {stringify(message['data'])}\n\n")


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

    # Manually import built-in packages to get ordering correct
    # Using importlib here so we don't have to ignore that it isn't used
    importlib.import_module("packages.chaiNNer_standard")
    importlib.import_module("packages.chaiNNer_pytorch")
    importlib.import_module("packages.chaiNNer_ncnn")
    importlib.import_module("packages.chaiNNer_onnx")
    importlib.import_module("packages.chaiNNer_external")

    logger.info("Checking dependencies...")

    to_install: list[api.Dependency] = []
    for package in api.registry.packages.values():
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
        except Exception as ex:
            logger.error(f"Error installing dependencies: {ex}")
            if config.close_after_start:
                raise ValueError("Error installing dependencies") from ex

    logger.info("Done checking dependencies...")

    # TODO: in the future, for external packages dir, scan & import
    # for package in os.listdir(packages_dir):
    #     importlib.import_module(package)

    await update_progress_cb("Loading Nodes...", 1.0, None)

    load_errors = api.registry.load_nodes(__file__)
    if len(load_errors) > 0:
        import_errors: list[api.LoadErrorInfo] = []
        for e in load_errors:
            if not isinstance(e.error, ModuleNotFoundError):
                logger.warning(
                    f"Failed to load {e.module} ({e.file}):", exc_info=e.error
                )
            else:
                import_errors.append(e)

        if len(import_errors) > 0:
            logger.warning(f"Failed to import {len(import_errors)} modules:")
            for e in import_errors:
                logger.warning(f"{e.error}  ->  {e.module}")

        if config.error_on_failed_node:
            raise ValueError("Error importing nodes")


async def apple_silicon_setup():
    # enable mps fallback on apple silicon
    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"


async def setup(sanic_app: Sanic):
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

    if is_arm_mac:
        await apple_silicon_setup()

    await update_progress("Importing nodes...", 0.0, None)

    logger.info("Importing nodes...")

    # Now we can load all the nodes
    await import_packages(AppContext.get(sanic_app).config, update_progress)

    logger.info("Sending backend ready...")

    await update_progress("Loading Nodes...", 1.0, None)

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
    # pylint: disable=global-statement
    global exit_code

    try:
        await nodes_available()
    except Exception as ex:
        logger.error(f"Error waiting for server to start: {ex}")
        exit_code = 1

    # now we can close the server
    logger.info("Closing server...")
    sanic_app.stop()
    if session is not None:
        await session.close()


def start_executor_server():
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
            print("Failed to start server")
            sys.exit(1)
        for line in process.stdout:
            print(line.decode(), end="")


def stop_executor_server():
    global server_process
    if server_process is not None:
        server_process.kill()
        server_process = None


@app.after_server_start
async def after_server_start(sanic_app: Sanic, loop: asyncio.AbstractEventLoop):
    # pylint: disable=global-statement
    global setup_task

    # initialize the queues
    ctx = AppContext.get(sanic_app)
    ctx.queue = EventQueue()
    ctx.setup_queue = EventQueue()

    # start the setup task
    setup_task = loop.create_task(setup(sanic_app))

    # initialize aiohttp session
    global session
    session = aiohttp.ClientSession()

    # Start the executor server
    loop.run_in_executor(None, start_executor_server)

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
