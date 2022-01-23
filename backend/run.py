import asyncio
import gc
import os
import sys
import traceback
from json import dumps as stringify

from sanic import Sanic
from sanic.log import logger
from sanic.request import Request
from sanic.response import json
from sanic_cors import CORS

try:
    import cv2

    from nodes import opencv_nodes
except Exception as e:
    logger.warning(e)
    logger.info("OpenCV most likely not installed")

try:
    import numpy

    from nodes import numpy_nodes
except Exception as e:
    logger.warning(e)
    logger.info("NumPy most likely not installed")

try:
    import torch

    from nodes import pytorch_nodes
except Exception as e:
    torch = None
    logger.warning(e)
    logger.info("PyTorch most likely not installed")

from nodes.node_factory import NodeFactory
from process import Executor

app = Sanic("chaiNNer")
CORS(app)
app.ctx.executor = None

app.config.REQUEST_TIMEOUT = sys.maxsize
app.config.RESPONSE_TIMEOUT = sys.maxsize

import logging

from sanic.log import access_logger


class SSEFilter(logging.Filter):
    def filter(self, record):
        return not (record.request.endswith("/sse") and record.status == 200)


access_logger.addFilter(SSEFilter())


@app.route("/nodes")
async def nodes(_):
    """Gets a list of all nodes as well as the node information"""
    registry = NodeFactory.get_registry()
    output = []
    for category in registry:
        category_dict = {"category": category, "nodes": []}
        for node in registry[category]:
            node_object = NodeFactory.create_node(category, node)
            node_dict = {"name": node}
            node_dict["inputs"] = node_object.get_inputs()
            node_dict["outputs"] = node_object.get_outputs()
            node_dict["description"] = node_object.get_description()

            category_dict["nodes"].append(node_dict)
        output.append(category_dict)
    return json(output)


@app.route("/run", methods=["POST"])
async def run(request: Request):
    """Runs the provided nodes"""
    # headers = {"Cache-Control": "no-cache"}
    # await request.respond(response="Run request accepted", status=200, headers=headers)
    queue = request.app.ctx.queue

    try:
        if request.app.ctx.executor:
            logger.info("Resuming existing executor...")
            executor = request.app.ctx.executor
            await executor.run()
        else:
            logger.info("Running new executor...")
            full_data = request.json
            logger.info(full_data)
            nodes_list = full_data["data"]
            os.environ["device"] = "cpu" if bool(full_data["isCpu"]) else "cuda"
            os.environ["isFp16"] = (
                "False" if bool(full_data["isCpu"]) else str(full_data["isFp16"])
            )
            os.environ["resolutionX"] = str(full_data["resolutionX"])
            os.environ["resolutionY"] = str(full_data["resolutionY"])
            executor = Executor(nodes_list, app.loop, queue)
            request.app.ctx.executor = executor
            await executor.run()
        if not executor.paused:
            del request.app.ctx.executor
            request.app.ctx.executor = None
        if torch is not None:
            torch.cuda.empty_cache()
        gc.collect()
        await queue.put(
            {"event": "finish", "data": {"message": "Successfully ran nodes!"}}
        )
        return json({"message": "Successfully ran nodes!"}, status=200)
    except Exception as exception:
        logger.error(exception, exc_info=1)
        request.app.ctx.executor = None
        logger.error(traceback.format_exc())
        await queue.put(
            {
                "event": "error",
                "data": {
                    "message": "Error running nodes!",
                    "exception": str(exception),
                },
            }
        )
        return json(
            {"message": "Error running nodes!", "exception": str(exception)}, status=500
        )


@app.get("/sse")
async def sse(request: Request):
    headers = {"Cache-Control": "no-cache"}
    response = await request.respond(headers=headers, content_type="text/event-stream")
    while True:
        message = await request.app.ctx.queue.get()
        if not message:
            break
        await response.send(f"event: {message['event']}\n")
        await response.send(f"data: {stringify(message['data'])}\n\n")


@app.after_server_start
async def setup_queue(app: Sanic, _):
    app.ctx.queue = asyncio.Queue()


@app.route("/pause", methods=["POST"])
async def kill(request):
    """Pauses the current execution"""
    try:
        if request.app.ctx.executor:
            logger.info("Executor found. Attempting to pause...")
            await request.app.ctx.executor.pause()
            return json({"message": "Successfully paused execution!"}, status=200)
        logger.info("No executor to pause")
        return json({"message": "No executor to pause!"}, status=200)
    except Exception as exception:
        logger.log(2, exception, exc_info=1)
        return json(
            {"message": "Error pausing execution!", "exception": str(exception)},
            status=500,
        )


@app.route("/kill", methods=["POST"])
async def kill(request):
    """Kills the current execution"""
    try:
        if request.app.ctx.executor:
            logger.info("Executor found. Attempting to kill...")
            await request.app.ctx.executor.kill()
            request.app.ctx.executor = None
            return json({"message": "Successfully killed execution!"}, status=200)
        logger.info("No executor to kill")
        return json({"message": "No executor to kill!"}, status=200)
    except Exception as exception:
        logger.log(2, exception, exc_info=1)
        return json(
            {"message": "Error killing execution!", "exception": str(exception)},
            status=500,
        )


if __name__ == "__main__":
    try:
        port = sys.argv[1] or 8000
    except:
        port = 8000
    app.run(port=port)
