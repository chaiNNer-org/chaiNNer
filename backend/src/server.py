import asyncio
import functools
import gc
import importlib
import logging
import sys
import traceback
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from json import dumps as stringify
from typing import Dict, List, Optional, TypedDict, Union

import psutil
from sanic import Sanic
from sanic.log import access_logger, logger
from sanic.request import Request
from sanic.response import json
from sanic_cors import CORS

import api
from base_types import NodeId
from chain.cache import OutputCache
from chain.json import JsonNode, parse_json
from chain.optimize import optimize
from custom_types import UpdateProgressFn
from dependencies.store import DependencyInfo, install_dependencies, installed_packages
from events import EventQueue, ExecutionErrorData
from gpu import get_nvidia_helper
from nodes.group import Group
from nodes.utils.exec_options import (
    JsonExecutionOptions,
    parse_execution_options,
    set_execution_options,
)
from process import (
    Executor,
    NodeExecutionError,
    Output,
    compute_broadcast,
    run_node,
    timed_supplier,
)
from progress_controller import Aborted
from response import (
    alreadyRunningResponse,
    errorResponse,
    noExecutorResponse,
    successResponse,
)
from server_config import ServerConfig


class AppContext:
    def __init__(self):
        self.config: ServerConfig = None  # type: ignore
        self.executor: Optional[Executor] = None
        self.cache: Dict[NodeId, Output] = dict()
        # This will be initialized by after_server_start.
        # This is necessary because we don't know Sanic's event loop yet.
        self.queue: EventQueue = None  # type: ignore
        self.setup_queue: EventQueue = None  # type: ignore
        self.pool = ThreadPoolExecutor(max_workers=4)

    @staticmethod
    def get(app_instance: Sanic) -> "AppContext":
        assert isinstance(app_instance.ctx, AppContext)
        return app_instance.ctx


app = Sanic("chaiNNer", ctx=AppContext())
app.config.REQUEST_TIMEOUT = sys.maxsize
app.config.RESPONSE_TIMEOUT = sys.maxsize
CORS(app)


class SSEFilter(logging.Filter):
    def filter(self, record):
        return not ((record.request.endswith("/sse") or record.request.endswith("/setup-sse")) and record.status == 200)  # type: ignore


class ZeroCounter:
    def __init__(self) -> None:
        self.count = 0

    async def wait_zero(self) -> None:
        while self.count != 0:
            await asyncio.sleep(0.01)

    def __enter__(self):
        self.count += 1

    def __exit__(self, _exc_type, _exc_value, _exc_traceback):
        self.count -= 1


runIndividualCounter = ZeroCounter()

setup_task = None


async def nodes_available():
    if setup_task is not None:
        await setup_task


access_logger.addFilter(SSEFilter())


@app.route("/nodes")
async def nodes(_request: Request):
    """Gets a list of all nodes as well as the node information"""
    await nodes_available()
    logger.debug(api.registry.categories)

    node_list = []
    for node, sub in api.registry.nodes.values():
        node_dict = {
            "schemaId": node.schema_id,
            "name": node.name,
            "category": sub.category.name,
            "inputs": [x.toDict() for x in node.inputs],
            "outputs": [x.toDict() for x in node.outputs],
            "groupLayout": [
                g.toDict() if isinstance(g, Group) else g for g in node.group_layout
            ],
            "description": node.description,
            "seeAlso": node.see_also,
            "icon": node.icon,
            "subcategory": sub.name,
            "nodeType": node.type,
            "hasSideEffects": node.side_effects,
            "deprecated": node.deprecated,
            "defaultNodes": node.default_nodes,
        }
        node_list.append(node_dict)

    return json(
        {
            "nodes": node_list,
            "categories": [x.toDict() for x in api.registry.categories],
            "categoriesMissingNodes": [],
        }
    )


class RunRequest(TypedDict):
    data: List[JsonNode]
    options: JsonExecutionOptions
    sendBroadcastData: bool


@app.route("/run", methods=["POST"])
async def run(request: Request):
    """Runs the provided nodes"""
    await nodes_available()
    ctx = AppContext.get(request.app)

    if ctx.executor:
        message = "Cannot run another executor while the first one is still running."
        logger.warning(message)
        return json(alreadyRunningResponse(message), status=500)

    try:
        # wait until all previews are done
        await runIndividualCounter.wait_zero()

        full_data: RunRequest = dict(request.json)  # type: ignore
        logger.debug(full_data)
        chain, inputs = parse_json(full_data["data"])
        optimize(chain)

        logger.info("Running new executor...")
        exec_opts = parse_execution_options(full_data["options"])
        set_execution_options(exec_opts)
        logger.debug(f"Using device: {exec_opts.full_device}")
        executor = Executor(
            chain,
            inputs,
            full_data["sendBroadcastData"],
            app.loop,
            ctx.queue,
            ctx.pool,
            parent_cache=OutputCache(static_data=ctx.cache.copy()),
        )
        try:
            ctx.executor = executor
            await executor.run()
        except Aborted:
            pass
        finally:
            ctx.executor = None
            gc.collect()

        await ctx.queue.put(
            {"event": "finish", "data": {"message": "Successfully ran nodes!"}}
        )
        return json(successResponse("Successfully ran nodes!"), status=200)
    except Exception as exception:
        logger.error(exception, exc_info=True)
        logger.error(traceback.format_exc())

        error: ExecutionErrorData = {
            "message": "Error running nodes!",
            "source": None,
            "exception": str(exception),
        }
        if isinstance(exception, NodeExecutionError):
            error["source"] = {
                "nodeId": exception.node_id,
                "schemaId": exception.node_data.schema_id,
                "inputs": exception.inputs,
            }

        await ctx.queue.put({"event": "execution-error", "data": error})
        return json(errorResponse("Error running nodes!", exception), status=500)


class RunIndividualRequest(TypedDict):
    id: NodeId
    inputs: List[object]
    schemaId: str
    options: JsonExecutionOptions


@app.route("/run/individual", methods=["POST"])
async def run_individual(request: Request):
    """Runs a single node"""
    await nodes_available()
    ctx = AppContext.get(request.app)
    try:
        full_data: RunIndividualRequest = dict(request.json)  # type: ignore
        node_id = full_data["id"]
        if ctx.cache.get(node_id, None) is not None:
            del ctx.cache[node_id]
        logger.debug(full_data)
        exec_opts = parse_execution_options(full_data["options"])
        set_execution_options(exec_opts)
        logger.debug(f"Using device: {exec_opts.full_device}")
        # Create node based on given category/name information
        node_instance = api.registry.get_node(full_data["schemaId"])

        with runIndividualCounter:
            # Run the node and pass in inputs as args
            output, execution_time = await app.loop.run_in_executor(
                None,
                timed_supplier(
                    functools.partial(
                        run_node, node_instance, full_data["inputs"], node_id
                    )
                ),
            )
            # Cache the output of the node
            ctx.cache[node_id] = output

        # Broadcast the output from the individual run
        node_outputs = node_instance.outputs
        if len(node_outputs) > 0:
            data, types = compute_broadcast(output, node_outputs)
            await ctx.queue.put(
                {
                    "event": "node-finish",
                    "data": {
                        "finished": [],
                        "nodeId": node_id,
                        "executionTime": execution_time,
                        "data": data,
                        "types": types,
                        "progressPercent": None,
                    },
                }
            )
        gc.collect()
        return json({"success": True, "data": None})
    except Exception as exception:
        logger.error(exception, exc_info=True)
        return json({"success": False, "error": str(exception)})


@app.route("/clearcache/individual", methods=["POST"])
async def clear_cache_individual(request: Request):
    await nodes_available()
    ctx = AppContext.get(request.app)
    try:
        full_data = dict(request.json)  # type: ignore
        if ctx.cache.get(full_data["id"], None) is not None:
            del ctx.cache[full_data["id"]]
        return json({"success": True, "data": None})
    except Exception as exception:
        logger.error(exception, exc_info=True)
        return json({"success": False, "error": str(exception)})


@app.route("/pause", methods=["POST"])
async def pause(request: Request):
    """Pauses the current execution"""
    await nodes_available()
    ctx = AppContext.get(request.app)

    if not ctx.executor:
        message = "No executor to pause"
        logger.warning(message)
        return json(noExecutorResponse(message), status=400)

    try:
        logger.info("Executor found. Attempting to pause...")
        ctx.executor.pause()
        return json(successResponse("Successfully paused execution!"), status=200)
    except Exception as exception:
        logger.log(2, exception, exc_info=True)
        return json(errorResponse("Error pausing execution!", exception), status=500)


@app.route("/resume", methods=["POST"])
async def resume(request: Request):
    """Pauses the current execution"""
    await nodes_available()
    ctx = AppContext.get(request.app)

    if not ctx.executor:
        message = "No executor to resume"
        logger.warning(message)
        return json(noExecutorResponse(message), status=400)

    try:
        logger.info("Executor found. Attempting to resume...")
        ctx.executor.resume()
        return json(successResponse("Successfully resumed execution!"), status=200)
    except Exception as exception:
        logger.log(2, exception, exc_info=True)
        return json(errorResponse("Error resuming execution!", exception), status=500)


@app.route("/kill", methods=["POST"])
async def kill(request: Request):
    """Kills the current execution"""
    await nodes_available()
    ctx = AppContext.get(request.app)

    if not ctx.executor:
        message = "No executor to kill"
        logger.warning("No executor to kill")
        return json(noExecutorResponse(message), status=400)

    try:
        logger.info("Executor found. Attempting to kill...")
        ctx.executor.kill()
        while ctx.executor:
            await asyncio.sleep(0.0001)
        return json(successResponse("Successfully killed execution!"), status=200)
    except Exception as exception:
        logger.log(2, exception, exc_info=True)
        return json(errorResponse("Error killing execution!", exception), status=500)


@app.route("/listgpus/ncnn", methods=["GET"])
async def list_ncnn_gpus(_request: Request):
    """Lists the available GPUs for NCNN"""
    await nodes_available()
    try:
        # pylint: disable=import-outside-toplevel
        from ncnn_vulkan import ncnn

        result = []
        for i in range(ncnn.get_gpu_count()):
            result.append(ncnn.get_gpu_info(i).device_name())
        return json(result)
    except Exception as exception:
        try:
            from ncnn import ncnn

            result = ["cpu"]
            return json(result)
        except Exception as exception2:
            logger.error(exception, exc_info=True)
            logger.error(exception2, exc_info=True)
            return json([])


@app.route("/listgpus/nvidia", methods=["GET"])
async def list_nvidia_gpus(_request: Request):
    """Lists the available GPUs for NCNN"""
    await nodes_available()
    try:
        nv = get_nvidia_helper()

        if nv is None:
            return json([])

        result = nv.list_gpus()
        return json(result)
    except Exception as exception:
        logger.error(exception, exc_info=True)
        return json([])


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


@app.route("/dependencies", methods=["GET"])
async def get_dependencies(_request: Request):
    await nodes_available()
    all_dependencies = []
    for package in api.registry.packages.values():
        pkg_dependencies = []
        for pkg_dep in package.dependencies:
            installed_version = installed_packages.get(pkg_dep.pypi_name, None)
            pkg_dep_item = {
                **pkg_dep.toDict(),
            }
            if installed_version is None:
                pkg_dep_item["installed"] = None
            else:
                pkg_dep_item["installed"] = installed_version
            pkg_dependencies.append(pkg_dep_item)
        if package.name == "chaiNNer_standard":
            continue
        else:
            all_dependencies.append(
                {
                    "name": package.name,
                    "dependencies": pkg_dependencies,
                    "description": package.description,
                }
            )
    return json(all_dependencies)


async def import_packages(
    config: ServerConfig,
    update_progress_cb: UpdateProgressFn,
):
    async def install_deps(dependencies: List[api.Dependency]):
        try:
            dep_info: List[DependencyInfo] = [
                {
                    "package_name": dep.pypi_name,
                    "display_name": dep.display_name,
                    "version": dep.version,
                    "from_file": None,
                }
                for dep in dependencies
            ]
            await install_dependencies(dep_info, update_progress_cb, logger)
        except Exception as ex:
            logger.error(f"Error installing dependencies: {ex}")

    # Manually import built-in packages to get ordering correct
    # Using importlib here so we don't have to ignore that it isn't used
    importlib.import_module("packages.chaiNNer_standard")
    importlib.import_module("packages.chaiNNer_pytorch")
    importlib.import_module("packages.chaiNNer_ncnn")
    importlib.import_module("packages.chaiNNer_onnx")
    importlib.import_module("packages.chaiNNer_external")

    logger.info("Checking dependencies...")

    to_install: List[api.Dependency] = []
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
        await install_deps(to_install)

    logger.info("Done checking dependencies...")

    # TODO: in the future, for external packages dir, scan & import
    # for package in os.listdir(packages_dir):
    #     importlib.import_module(package)

    await update_progress_cb("Loading Nodes...", 1.0, None)

    api.registry.load_nodes(__file__)


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


async def setup(sanic_app: Sanic):
    setup_queue = AppContext.get(sanic_app).setup_queue

    async def update_progress(
        message: str, progress: float, status_progress: Union[float, None] = None
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
        exit_code = 0
    except Exception as ex:
        logger.error(f"Error waiting for server to start: {ex}")
        exit_code = 1

    # now we can close the server
    logger.info("Closing server...")
    sanic_app.stop()


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
