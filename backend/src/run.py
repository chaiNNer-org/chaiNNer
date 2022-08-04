import asyncio
from concurrent.futures import ThreadPoolExecutor
import functools
import gc
import logging
import os
import platform
import sys
import traceback
from json import dumps as stringify
from typing import Any, Dict, List, Optional, TypedDict

# pylint: disable=unused-import
import cv2
from sanic import Sanic
from sanic.log import logger
from sanic.request import Request
from sanic.response import json
from sanic_cors import CORS

from nodes.categories import category_order

# Remove broken QT env var
if platform.system() == "Linux":
    os.environ.pop("QT_QPA_PLATFORM_PLUGIN_PATH")

# pylint: disable=ungrouped-imports,wrong-import-position
from nodes import image_adj_nodes  # type: ignore
from nodes import image_chan_nodes  # type: ignore
from nodes import image_dim_nodes  # type: ignore
from nodes import image_filter_nodes  # type: ignore
from nodes import image_iterator_nodes  # type: ignore
from nodes import image_nodes  # type: ignore
from nodes import image_util_nodes  # type: ignore

try:
    import torch

    # pylint: disable=unused-import,ungrouped-imports
    from nodes import pytorch_nodes  # type: ignore
except Exception as e:
    torch = None
    logger.warning(e)
    logger.info("PyTorch most likely not installed")

try:
    import onnx
    import onnxruntime

    # pylint: disable=unused-import,ungrouped-imports
    from nodes import onnx_nodes  # type: ignore
except Exception as e:
    logger.warning(e)
    logger.info("ONNX most likely not installed")


try:
    # pylint: disable=unused-import
    import ncnn_vulkan

    # pylint: disable=unused-import,ungrouped-imports
    from nodes import ncnn_nodes  # type: ignore
except Exception as e:
    logger.warning(e)
    logger.info("NCNN most likely not installed")

# pylint: disable=unused-import
from nodes import utility_nodes  # type: ignore
from nodes.node_factory import NodeFactory
from events import EventQueue, ExecutionErrorData
from process import Executor, NodeExecutionError, UsableData, timed_supplier
from nodes.utils.exec_options import set_execution_options, ExecutionOptions


class AppContext:
    def __init__(self):
        self.executor: Optional[Executor] = None
        self.cache: Dict[str, Any] = dict()
        # This will be initialized by setup_queue.
        # This is necessary because we don't know Sanic's event loop yet.
        self.queue: EventQueue = None  # type: ignore
        self.pool = ThreadPoolExecutor(max_workers=4)

    @staticmethod
    def get(app: Sanic) -> "AppContext":
        assert isinstance(app.ctx, AppContext)
        return app.ctx


app = Sanic("chaiNNer", ctx=AppContext())
app.config.REQUEST_TIMEOUT = sys.maxsize
app.config.RESPONSE_TIMEOUT = sys.maxsize
CORS(app)


from sanic.log import access_logger


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
    registry = NodeFactory.get_registry()
    logger.debug(category_order)

    # sort nodes in category order
    sorted_registry = sorted(
        registry.items(),
        key=lambda x: category_order.index(
            NodeFactory.create_node(x[0]).get_category()
        ),
    )
    node_list = []
    for schema_id, _node_class in sorted_registry:
        node_object = NodeFactory.create_node(schema_id)
        node_dict = {
            "schemaId": schema_id,
            "name": node_object.get_name(),
            "category": node_object.get_category(),
            "inputs": [
                x.toDict() for x in node_object.get_inputs(with_implicit_ids=True)
            ],
            "outputs": [
                x.toDict() for x in node_object.get_outputs(with_implicit_ids=True)
            ],
            "description": node_object.get_description(),
            "icon": node_object.get_icon(),
            "subcategory": node_object.get_sub_category(),
            "nodeType": node_object.get_type(),
            "hasSideEffects": node_object.get_has_side_effects(),
            "deprecated": node_object.is_deprecated(),
        }
        if node_object.get_type() == "iterator":
            node_dict["defaultNodes"] = node_object.get_default_nodes()  # type: ignore
        node_list.append(node_dict)
    return json(node_list)


class RunRequest(TypedDict):
    data: Dict[str, UsableData]
    isCpu: bool
    isFp16: bool


@app.route("/run", methods=["POST"])
async def run(request: Request):
    """Runs the provided nodes"""
    ctx = AppContext.get(request.app)

    try:
        # wait until all previews are done
        await runIndividualCounter.wait_zero()

        if ctx.executor:
            logger.info("Resuming existing executor...")
            executor = ctx.executor
            await executor.resume()
        else:
            logger.info("Running new executor...")
            full_data: RunRequest = dict(request.json)  # type: ignore
            logger.info(full_data)
            nodes_list = full_data["data"]
            exec_opts = ExecutionOptions(
                device="cpu" if full_data["isCpu"] else "cuda",
                fp16=full_data["isFp16"],
            )
            set_execution_options(exec_opts)
            logger.info(f"Using device: {exec_opts.device}")
            executor = Executor(
                nodes_list,
                app.loop,
                ctx.queue,
                ctx.pool,
                ctx.cache.copy(),
            )
            ctx.executor = executor
            await executor.run()
        if not executor.paused:
            ctx.executor = None
        if torch is not None:
            torch.cuda.empty_cache()
        gc.collect()
        await ctx.queue.put(
            {"event": "finish", "data": {"message": "Successfully ran nodes!"}}
        )
        return json({"message": "Successfully ran nodes!"}, status=200)
    except Exception as exception:
        logger.error(exception, exc_info=True)
        ctx.executor = None
        logger.error(traceback.format_exc())

        error: ExecutionErrorData = {
            "message": "Error running nodes!",
            "source": None,
            "exception": str(exception),
        }
        if isinstance(exception, NodeExecutionError):
            error["source"] = {
                "nodeId": exception.node["id"],
                "schemaId": exception.node["schemaId"],
            }

        await ctx.queue.put({"event": "execution-error", "data": error})
        return json(error, status=500)


class RunIndividualRequest(TypedDict):
    id: str
    inputs: List[Any]
    isCpu: bool
    isFp16: bool
    schemaId: str


@app.route("/run/individual", methods=["POST"])
async def run_individual(request: Request):
    """Runs a single node"""
    ctx = AppContext.get(request.app)
    try:
        full_data: RunIndividualRequest = dict(request.json)  # type: ignore
        if ctx.cache.get(full_data["id"], None) is not None:
            del ctx.cache[full_data["id"]]
        logger.info(full_data)
        exec_opts = ExecutionOptions(
            device="cpu" if full_data["isCpu"] else "cuda",
            fp16=full_data["isFp16"],
        )
        set_execution_options(exec_opts)
        logger.info(f"Using device: {exec_opts.device}")
        # Create node based on given category/name information
        node_instance = NodeFactory.create_node(full_data["schemaId"])

        # Enforce that all inputs match the expected input schema
        enforced_inputs = []
        if node_instance.type == "iteratorHelper":
            enforced_inputs = full_data["inputs"]
        else:
            node_inputs = node_instance.get_inputs(with_implicit_ids=True)
            for idx, node_input in enumerate(full_data["inputs"]):
                enforced_inputs.append(node_inputs[idx].enforce_(node_input))

        with runIndividualCounter:
            # Run the node and pass in inputs as args
            run_func = functools.partial(node_instance.run, *full_data["inputs"])
            output, execution_time = await app.loop.run_in_executor(
                None, timed_supplier(run_func)
            )

            # Cache the output of the node
            ctx.cache[full_data["id"]] = output

        # Broadcast the output from the individual run
        broadcast_data: Dict[int, Any] = dict()
        node_outputs = node_instance.get_outputs(with_implicit_ids=True)
        if len(node_outputs) > 0:
            output_idxable = [output] if len(node_outputs) == 1 else output
            for idx, node_output in enumerate(node_outputs):
                try:
                    output_id = node_output.id if node_output.id is not None else idx
                    broadcast_data[output_id] = node_output.get_broadcast_data(
                        output_idxable[idx]
                    )
                except Exception as error:
                    logger.error(f"Error broadcasting output: {error}")
            await ctx.queue.put(
                {
                    "event": "node-finish",
                    "data": {
                        "finished": [],
                        "nodeId": full_data["id"],
                        "executionTime": execution_time,
                        "data": broadcast_data,
                    },
                }
            )
        del node_instance, run_func
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
    try:
        if ctx.executor:
            logger.info("Executor found. Attempting to pause...")
            await ctx.executor.pause()
            return json({"message": "Successfully paused execution!"}, status=200)
        logger.info("No executor to pause")
        return json({"message": "No executor to pause!"}, status=200)
    except Exception as exception:
        logger.log(2, exception, exc_info=True)
        return json(
            {"message": "Error pausing execution!", "exception": str(exception)},
            status=500,
        )


@app.route("/kill", methods=["POST"])
async def kill(request: Request):
    """Kills the current execution"""
    ctx = AppContext.get(request.app)
    try:
        if ctx.executor:
            logger.info("Executor found. Attempting to kill...")
            await ctx.executor.kill()
            ctx.executor = None
            return json({"message": "Successfully killed execution!"}, status=200)
        logger.info("No executor to kill")
        return json({"message": "No executor to kill!"}, status=200)
    except Exception as exception:
        logger.log(2, exception, exc_info=True)
        return json(
            {"message": "Error killing execution!", "exception": str(exception)},
            status=500,
        )


if __name__ == "__main__":
    try:
        port = int(sys.argv[1]) or 8000
    except:
        port = 8000

    if sys.argv[1] != "--no-run":
        app.run(port=port)
