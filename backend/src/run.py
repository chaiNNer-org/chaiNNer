import asyncio
import functools
import gc
import importlib
import logging
import sys
import traceback
from concurrent.futures import ThreadPoolExecutor
from json import dumps as stringify
from typing import Dict, List, Optional, TypedDict

# pylint: disable-next=unused-import
import cv2  # type: ignore
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
from events import EventQueue, ExecutionErrorData
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


class AppContext:
    def __init__(self):
        self.executor: Optional[Executor] = None
        self.cache: Dict[NodeId, Output] = dict()
        # This will be initialized by setup_queue.
        # This is necessary because we don't know Sanic's event loop yet.
        self.queue: EventQueue = None  # type: ignore
        self.pool = ThreadPoolExecutor(max_workers=4)

    @staticmethod
    def get(app_instance: Sanic) -> "AppContext":
        assert isinstance(app_instance.ctx, AppContext)
        return app_instance.ctx


app = Sanic("chaiNNer", ctx=AppContext())
app.config.REQUEST_TIMEOUT = sys.maxsize
app.config.RESPONSE_TIMEOUT = sys.maxsize
CORS(app)

# Manually import built-in packages to get ordering correct
# Using importlib here so we don't have to ignore that it isn't used
importlib.import_module("packages.chaiNNer_standard")
importlib.import_module("packages.chaiNNer_pytorch")
importlib.import_module("packages.chaiNNer_ncnn")
importlib.import_module("packages.chaiNNer_onnx")
importlib.import_module("packages.chaiNNer_external")

# in the future, for external packages dir, scan & import
# for package in os.listdir(packages_dir):
#     # logger.info(package)
#     importlib.import_module(package)

api.registry.load_nodes(__file__)


class SSEFilter(logging.Filter):
    def filter(self, record):
        return not (record.request.endswith("/sse") and record.status == 200)  # type: ignore


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


access_logger.addFilter(SSEFilter())


@app.route("/nodes")
async def nodes(_):
    """Gets a list of all nodes as well as the node information"""
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
    ctx = AppContext.get(request.app)
    try:
        full_data = dict(request.json)  # type: ignore
        if ctx.cache.get(full_data["id"], None) is not None:
            del ctx.cache[full_data["id"]]
        return json({"success": True, "data": None})
    except Exception as exception:
        logger.error(exception, exc_info=True)
        return json({"success": False, "error": str(exception)})


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


@app.after_server_start
async def setup_queue(sanic_app: Sanic, _):
    AppContext.get(sanic_app).queue = EventQueue()


@app.route("/pause", methods=["POST"])
async def pause(request: Request):
    """Pauses the current execution"""
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
    try:
        # pylint: disable=import-outside-toplevel
        from ncnn_vulkan import ncnn

        result = []
        for i in range(ncnn.get_gpu_count()):
            result.append(ncnn.get_gpu_info(i).device_name())
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


if __name__ == "__main__":
    try:
        port = int(sys.argv[1]) or 8000
    except:
        port = 8000

    if sys.argv[1] != "--no-run":
        app.run(port=port, single_process=True)
