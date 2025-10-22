from __future__ import annotations

import asyncio
import logging
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from functools import cached_property
from json import dumps as stringify
from json import loads as json_parse
from pathlib import Path
from typing import Final

import psutil
from sanic import Sanic
from sanic.log import access_logger
from sanic.request import Request
from sanic.response import json
from sanic_cors import CORS

import api
from custom_types import UpdateProgressFn
from dependencies.store import (
    DependencyInfo,
    filter_necessary_to_install,
    install_dependencies,
    installed_packages,
    uninstall_dependencies,
)
from events import EventQueue
from gpu import nvidia

from logger import logger, setup_logger
from response import error_response, success_response
from server_config import ServerConfig
from server_process_helper import WorkerServer


class AppContext:
    def __init__(self):
        self.config: Final[ServerConfig] = ServerConfig.parse_argv()

        # Configure logger with logs directory from config if provided
        if self.config.logs_dir:
            log_dir = Path(self.config.logs_dir)
            # Reconfigure the existing logger with the specified directory
            # Remove existing handlers
            for handler in logger.handlers[:]:
                logger.removeHandler(handler)
                handler.close()
            # Set up logger again with the correct directory
            setup_logger("host", log_dir=log_dir)

        # flags to pass along to the worker
        worker_flags: list[str] = []
        if self.config.storage_dir is not None:
            worker_flags.extend(["--storage-dir", self.config.storage_dir])
        if self.config.logs_dir is not None:
            worker_flags.extend(["--logs-dir", self.config.logs_dir])
        if self.config.trace:
            worker_flags.append("--trace")

        self._worker: Final[WorkerServer] = WorkerServer(worker_flags)
        self.pool: Final[ThreadPoolExecutor] = ThreadPoolExecutor(max_workers=4)
        self.is_ready = False

    def get_worker_unmanaged(self) -> WorkerServer:
        """
        Returns the worker server instance no matter what state it is currently in.
        """
        return self._worker

    async def get_worker(self) -> WorkerServer:
        """
        Returns the worker server instance after it is ready.
        """
        while not self.is_ready:
            await asyncio.sleep(0.1)
        return self._worker

    @cached_property
    def setup_queue(self) -> EventQueue:
        return EventQueue()

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


access_logger.addFilter(SSEFilter())


@app.route("/health")
async def health(_request: Request):
    """Simple health check endpoint that doesn't require full setup"""
    return json({"status": "ok"})


@app.route("/nodes")
async def nodes(request: Request):
    worker = await AppContext.get(request.app).get_worker()
    return await worker.proxy_request(request)


@app.route("/run", methods=["POST"])
async def run(request: Request):
    worker = await AppContext.get(request.app).get_worker()
    return await worker.proxy_request(request, timeout=None)


@app.route("/run/individual", methods=["POST"])
async def run_individual(request: Request):
    worker = await AppContext.get(request.app).get_worker()
    return await worker.proxy_request(request)


@app.route("/clear-cache/individual", methods=["POST"])
async def clear_cache_individual(request: Request):
    worker = await AppContext.get(request.app).get_worker()
    return await worker.proxy_request(request)


@app.route("/pause", methods=["POST"])
async def pause(request: Request):
    worker = await AppContext.get(request.app).get_worker()
    return await worker.proxy_request(request)


@app.route("/resume", methods=["POST"])
async def resume(request: Request):
    worker = await AppContext.get(request.app).get_worker()
    return await worker.proxy_request(request, timeout=None)


@app.route("/kill", methods=["POST"])
async def kill(request: Request):
    worker = await AppContext.get(request.app).get_worker()
    try:
        response = await worker.proxy_request(request, timeout=3)
        if response.status > 200:
            if response.body is None:
                raise Exception(
                    "Unknown error occurred while attempting to stop execution."
                )
            raise Exception(response.body.decode())
    except Exception:
        try:
            logger.debug(
                "Regular kill failed, attempting to restart executor process..."
            )
            await worker.restart()
        except Exception as exception:
            return json(
                error_response("Error killing execution!", exception), status=500
            )
    return json(success_response(), status=200)


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
    for device in nvidia.devices:
        usage = device.get_current_vram_usage()
        stats_list.append(
            SystemStat(
                f"VRAM {device.index}" if len(nvidia.devices) > 1 else "VRAM",
                usage.used / usage.total * 100,
            )
        )
    return json([asdict(x) for x in stats_list])


@app.route("/packages", methods=["GET"])
async def get_packages(request: Request):
    worker = await AppContext.get(request.app).get_worker()
    return await worker.proxy_request(request)


@app.route("/installed-dependencies", methods=["GET"])
async def get_installed_dependencies(request: Request):
    worker = await AppContext.get(request.app).get_worker()
    installed_deps: dict[str, str] = {}
    packages = await worker.get_packages()
    for package in packages:
        for pkg_dep in package.dependencies:
            installed_version = installed_packages.get(pkg_dep.pypi_name, None)
            if installed_version is not None:
                installed_deps[pkg_dep.pypi_name] = installed_version

    return json(installed_deps)


@app.route("/features")
async def get_features(request: Request):
    worker = await AppContext.get(request.app).get_worker()
    return await worker.proxy_request(request)


def deps_to_dep_info(deps: list[api.Dependency]) -> list[DependencyInfo]:
    return [
        DependencyInfo(
            package_name=dep.pypi_name,
            display_name=dep.display_name,
            version=dep.version,
            extra_index_url=dep.extra_index_url,
        )
        for dep in deps
    ]


def create_update_progress(ctx: AppContext) -> UpdateProgressFn:
    def update_progress(
        message: str,
        progress: float,
        status_progress: float | None = None,
    ):
        logger.info("Progress: %s %s %s", message, progress, status_progress)
        return ctx.setup_queue.put_and_wait(
            {
                "event": "package-install-status",
                "data": {
                    "message": message,
                    "progress": progress,
                    "statusProgress": status_progress,
                },
            },
            timeout=0.01,
        )

    return update_progress


@app.route("/packages/uninstall", methods=["POST"])
async def uninstall_dependencies_request(request: Request):
    package_ids_to_install: list[str] = request.json["packages"]

    ctx = AppContext.get(request.app)
    worker = await ctx.get_worker()
    packages = await worker.get_packages()

    packages_to_install = [x for x in packages if x.id in package_ids_to_install]
    valid_package_ids = [p.id for p in packages]
    invalid_package_ids = [
        x for x in package_ids_to_install if x not in valid_package_ids
    ]
    if len(invalid_package_ids) > 0:
        return json(
            {
                "status": "error",
                "message": f"Package {invalid_package_ids[0]} not found",
            },
            status=404,
        )

    try:
        progress = create_update_progress(ctx)
        deps: list[DependencyInfo] = []
        for p in packages_to_install:
            deps.extend(deps_to_dep_info(p.dependencies))

        if len(deps) > 0:
            await worker.stop()
            try:
                await uninstall_dependencies(deps, progress, logger)
            finally:
                await worker.start()

        return json({"status": "ok"})
    except Exception as ex:
        logger.exception("Error uninstalling dependencies: %s", ex)
        return json({"status": "error", "message": str(ex)}, status=500)


@app.route("/packages/install", methods=["POST"])
async def install_dependencies_request(request: Request):
    package_ids_to_install: list[str] = request.json["packages"]

    ctx = AppContext.get(request.app)
    worker = await ctx.get_worker()
    packages = await worker.get_packages()

    packages_to_install = [x for x in packages if x.id in package_ids_to_install]
    valid_package_ids = [p.id for p in packages]
    invalid_package_ids = [
        x for x in package_ids_to_install if x not in valid_package_ids
    ]
    if len(invalid_package_ids) > 0:
        return json(
            {
                "status": "error",
                "message": f"Package {invalid_package_ids[0]} not found",
            },
            status=404,
        )

    try:
        progress = create_update_progress(ctx)
        deps: list[DependencyInfo] = []
        for p in packages_to_install:
            deps.extend(deps_to_dep_info(p.dependencies))

        if len(deps) > 0:
            await worker.stop()
            try:
                await install_dependencies(deps, progress, logger)
            finally:
                await worker.start()
        return json({"status": "ok"})
    except Exception as ex:
        logger.exception("Error installing dependencies: %s", ex)
        return json({"status": "error", "message": str(ex)}, status=500)


@app.get("/sse")
async def sse(request: Request):
    headers = {"Cache-Control": "no-cache"}
    response = await request.respond(headers=headers, content_type="text/event-stream")
    if response is None:
        return

    worker = await AppContext.get(request.app).get_worker()
    while True:
        try:
            async for data in worker.get_sse(request):
                await response.send(data)
        except Exception:
            break


@app.get("/setup-sse")
async def setup_sse(request: Request):
    ctx = AppContext.get(request.app)
    headers = {"Cache-Control": "no-cache"}
    response = await request.respond(headers=headers, content_type="text/event-stream")
    if response is None:
        return

    while True:
        try:
            message = await ctx.setup_queue.get()
            await response.send(
                f"event: {message['event']}\n" f"data: {stringify(message['data'])}\n\n"
            )
        except Exception:
            break


@app.post("/shutdown")
async def shutdown(request: Request):
    await close_server(request.app)
    return json(success_response())


@app.get("/status")
async def status(request: Request):
    ctx = AppContext.get(request.app)

    worker_status = None
    if ctx.is_ready:
        try:
            worker = ctx.get_worker_unmanaged()
            worker_status = await worker.proxy_request(request)
            if worker_status.body is not None:
                # decode JSOn body
                worker_status = json_parse(worker_status.body)
        except Exception as ex:
            worker_status = {"success": False, "error": str(ex)}

    return json(
        {
            "ready": ctx.is_ready,
            "worker": worker_status,
        }
    )


async def import_packages(
    cxt: AppContext,
    update_progress_cb: UpdateProgressFn,
):
    config = cxt.config
    worker = cxt.get_worker_unmanaged()
    packages = await worker.get_packages()

    logger.info("Checking dependencies...")

    to_install: list[api.Dependency] = []
    for package in packages:
        logger.info("Checking dependencies for %s...", package.name)

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

    try:
        deps_to_install = filter_necessary_to_install(deps_to_dep_info(to_install))

        restart_flags: list[str] = []
        if config.error_on_failed_node:
            restart_flags.append("--error-on-failed-node")
        if config.close_after_start:
            restart_flags.append("--close-after-start")

        if len(restart_flags) > 0 or len(deps_to_install) > 0:
            await worker.stop()
            await install_dependencies(deps_to_install, update_progress_cb, logger)
            await worker.start(restart_flags)
        else:
            logger.info("No dependencies to install. Skipping worker restart.")
    except Exception as ex:
        logger.exception("Error installing dependencies: %s", ex)
        if config.close_after_start:
            raise ValueError("Error installing dependencies") from ex

    logger.info("Done checking dependencies...")


async def setup(sanic_app: Sanic, loop: asyncio.AbstractEventLoop):
    ctx = AppContext.get(sanic_app)
    worker = ctx.get_worker_unmanaged()
    setup_queue = ctx.setup_queue

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
    await import_packages(ctx, update_progress)

    logger.info("Backend almost ready...")

    await update_progress("Loading Nodes...", 1.0, None)

    # Wait to set backend-ready until nodes are loaded
    await worker.wait_for_ready()
    ctx.is_ready = True

    logger.info("Done.")


setup_task = None


async def close_server(sanic_app: Sanic):
    # now we can close the server
    logger.info("Closing server...")

    try:
        if setup_task is not None:
            await setup_task
    except Exception as ex:
        logger.error("Error waiting for server to start: %s", ex)

    worker = AppContext.get(sanic_app).get_worker_unmanaged()
    await worker.stop()
    sanic_app.stop()


@app.after_server_stop
async def after_server_stop(sanic_app: Sanic, _loop: asyncio.AbstractEventLoop):
    worker = AppContext.get(sanic_app).get_worker_unmanaged()
    await worker.stop()
    logger.info("Server closed.")


@app.after_server_start
async def after_server_start(sanic_app: Sanic, loop: asyncio.AbstractEventLoop):
    global setup_task

    # initialize the queues
    ctx = AppContext.get(sanic_app)

    worker = ctx.get_worker_unmanaged()
    await worker.start()
    await worker.wait_for_ready()

    # start the setup task
    setup_task = loop.create_task(setup(sanic_app, loop))

    # start task to close the server
    if ctx.config.close_after_start:
        loop.create_task(close_server(sanic_app))


def main():
    config = AppContext.get(app).config
    app.run(port=config.port, single_process=True)


if __name__ == "__main__":
    main()
