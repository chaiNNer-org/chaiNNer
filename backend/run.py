from sanic import Sanic
from sanic.response import json
from sanic_cors import CORS, cross_origin

from nodes.NodeFactory import NodeFactory

app = Sanic("chaiNNer")
CORS(app)


@app.route('/')
async def test(request):
    nodes_list = NodeFactory.get_nodes()
    return json(nodes_list)


if __name__ == '__main__':
    app.run()