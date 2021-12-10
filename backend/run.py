import asyncio
import sys

from sanic import Sanic
from sanic.log import logger
from sanic.response import json
from sanic_cors import CORS

try:
    import cv2

    from nodes import opencv_nodes
except:
    logger.info("OpenCV not installed")

try:
    import numpy

    from nodes import numpy_nodes
except:
    logger.info("NumPy not installed")

try:
    import torch

    from nodes import pytorch_nodes
except:
    logger.info("PyTorch not installed")

from nodes.node_factory import NodeFactory
from process import Executor

app = Sanic("chaiNNer")
CORS(app)
app.executor = None


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
async def run(request):
    """Runs the provided nodes"""
    try:
        if request.app.executor:
            logger.info("Resuming existing executor...")
            executor = request.app.executor
            await executor.run()
        else:
            logger.info("Running new executor...")
            nodes_list = request.json
            executor = Executor(nodes_list, app.loop)
            request.app.executor = executor
            await executor.run()
        if not executor.paused:
            request.app.executor = None
        return json({"message": "Successfully ran nodes!"}, status=200)
    except Exception as exception:
        logger.log(2, exception, exc_info=1)
        request.app.executor = None
        return json(
            {"message": "Error running nodes!", "exception": str(exception)}, status=500
        )


@app.route("/check", methods=["POST"])
async def check(request):
    """Check the execution status"""
    try:
        executor = request.app.executor
        if executor:
            response = await executor.check()
            return json(response, status=200)
        logger.info("No executor to check")
        return json({"message": "No executor to check!"}, status=200)
    except Exception as exception:
        print("🚀 ~ file: run.py ~ line 68 ~ exception", exception)
        logger.log(2, exception, exc_info=1)
        request.app.executor = None
        return json(
            {"message": "Error checking nodes!", "exception": str(exception)},
            status=500,
        )


@app.route("/pause", methods=["POST"])
async def kill(request):
    """Pauses the current execution"""
    try:
        if request.app.executor:
            logger.info("Executor found. Attempting to pause...")
            await request.app.executor.pause()
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
        if request.app.executor:
            logger.info("Executor found. Attempting to kill...")
            await request.app.executor.kill()
            request.app.executor = None
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
    port = sys.argv[1] or 8000
    app.run(port=port)
