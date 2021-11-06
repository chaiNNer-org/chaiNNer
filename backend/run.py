from sanic import Sanic
from sanic.log import logger
from sanic.response import json
from sanic_cors import CORS

from nodes import numpy_nodes, opencv_nodes, pytorch_nodes
from nodes.node_factory import NodeFactory
from process import Executor

app = Sanic("chaiNNer")
CORS(app)


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
    """Runs the provides nodes"""
    try:
        nodes_list = request.json
        executor = Executor(nodes_list)
        executor.run()
        return json({"message": "Successfully ran nodes!"}, status=200)
    except Exception as exception:
        logger.log(2, exception, exc_info=1)
        return json(
            {"message": "Error running nodes!", "exception": str(exception)}, status=500
        )


if __name__ == "__main__":
    app.run()
