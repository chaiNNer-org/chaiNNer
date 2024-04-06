from __future__ import annotations

import asyncio
import logging
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from json import dumps as stringify

import psutil
from sanic import Sanic
from sanic.log import access_logger, logger
from sanic.request import Request
from sanic.response import json
from sanic_cors import CORS

import api
from custom_types import UpdateProgressFn
from dependencies.store import (
    DependencyInfo,
    install_dependencies,
    installed_packages,
    uninstall_dependencies,
)
from events import EventQueue
from gpu import get_nvidia_helper
from response import error_response, success_response
from server_config import ServerConfig
from server_process_helper import WorkerServer


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


worker: WorkerServer = WorkerServer()

setup_task = None

access_logger.addFilter(SSEFilter())


@app.route("/nodes")
async def nodes(request: Request):
    resp = await worker.proxy_request(request)
    return resp


@app.route("/run", methods=["POST"])
async def run(request: Request):
    return await worker.proxy_request(request, timeout=None)


@app.route("/run/individual", methods=["POST"])
async def run_individual(request: Request):
    logger.info("Running individual")
    return await worker.proxy_request(request)


@app.route("/clear-cache/individual", methods=["POST"])
async def clear_cache_individual(request: Request):
    return await worker.proxy_request(request)


@app.route("/pause", methods=["POST"])
async def pause(request: Request):
    return await worker.proxy_request(request)


@app.route("/resume", methods=["POST"])
async def resume(request: Request):
    return await worker.proxy_request(request, timeout=None)


@app.route("/kill", methods=["POST"])
async def kill(request: Request):
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
    return await worker.proxy_request(request)


@app.route("/installed-dependencies", methods=["GET"])
async def get_installed_dependencies(request: Request):
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


@app.route("/packages/uninstall", methods=["POST"])
async def uninstall_dependencies_request(request: Request):
    full_data = dict(request.json)  # type: ignore
    package_to_uninstall = full_data["package"]

    packages = await worker.get_packages()

    package = next((x for x in packages if x.id == package_to_uninstall), None)

    if package is None:
        return json(
            {"status": "error", "message": f"Package {package_to_uninstall} not found"},
            status=404,
        )

    def update_progress(
        message: str, progress: float, status_progress: float | None = None
    ):
        return AppContext.get(request.app).setup_queue.put_and_wait(
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

    try:
        await worker.stop()
        try:
            await uninstall_dependencies(
                deps_to_dep_info(package.dependencies), update_progress, logger
            )
        finally:
            await worker.start()
        return json({"status": "ok"})
    except Exception as ex:
        logger.error(f"Error uninstalling dependencies: {ex}", exc_info=True)
        return json({"status": "error", "message": str(ex)}, status=500)


@app.route("/packages/install", methods=["POST"])
async def install_dependencies_request(request: Request):
    full_data = dict(request.json)  # type: ignore
    package_to_install = full_data["package"]

    def update_progress(
        message: str, progress: float, status_progress: float | None = None
    ):
        logger.info(f"Progress: {message} {progress} {status_progress}")
        return AppContext.get(request.app).setup_queue.put_and_wait(
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

    packages = await worker.get_packages()
    package = next((x for x in packages if x.id == package_to_install), None)

    if package is None:
        return json(
            {"status": "error", "message": f"Package {package_to_install} not found"},
            status=404,
        )

    try:
        await worker.stop()
        await install_dependencies(
            deps_to_dep_info(package.dependencies), update_progress, logger
        )
        await worker.start()
        return json({"status": "ok"})
    except Exception as ex:
        logger.error(f"Error installing dependencies: {ex}", exc_info=True)
        return json({"status": "error", "message": str(ex)}, status=500)


@app.get("/sse")
async def sse(request: Request):
    headers = {"Cache-Control": "no-cache"}
    response = await request.respond(headers=headers, content_type="text/event-stream")
    if response is None:
        return

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


async def import_packages(
    config: ServerConfig,
    update_progress_cb: UpdateProgressFn,
):
    async def install_deps(dependencies: list[api.Dependency]):
        dep_info: list[DependencyInfo] = [
            DependencyInfo(
                package_name=dep.pypi_name,
                display_name=dep.display_name,
                version=dep.version,
                extra_index_url=dep.extra_index_url,
            )
            for dep in dependencies
        ]
        num_installed = await install_dependencies(dep_info, update_progress_cb, logger)
        return num_installed

    packages = await worker.get_packages()

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

    try:
        if len(to_install) > 0:
            await worker.stop()

            await install_deps(to_install)
            flags = []
            if config.error_on_failed_node:
                flags.append("--error-on-failed-node")

            if config.close_after_start:
                flags.append("--close-after-start")

            await worker.start(flags)
    except Exception as ex:
        logger.error(f"Error installing dependencies: {ex}", exc_info=True)
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
    await worker.wait_for_ready()

    await setup_queue.put_and_wait(
        {
            "event": "backend-ready",
            "data": None,
        },
        timeout=1,
    )

    logger.info("Done.")


exit_code = 0

setup_task = None


async def close_server(sanic_app: Sanic):
    # now we can close the server
    logger.info("Closing server...")

    try:
        if setup_task is not None:
            await setup_task
    except Exception as ex:
        logger.error(f"Error waiting for server to start: {ex}")

    await worker.stop()
    sanic_app.stop()


@app.after_server_stop
async def after_server_stop(_sanic_app: Sanic, _loop: asyncio.AbstractEventLoop):
    await worker.stop()
    logger.info("Server closed.")


@app.after_server_start
async def after_server_start(sanic_app: Sanic, loop: asyncio.AbstractEventLoop):
    global setup_task
    await worker.start()

    # initialize the queues
    ctx = AppContext.get(sanic_app)
    ctx.setup_queue = EventQueue()

    await worker.wait_for_ready()

    # start the setup task
    setup_task = loop.create_task(setup(sanic_app, loop))

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
