from sanic import Sanic
from sanic.response import json
from sanic_cors import CORS, cross_origin

from nodes.NodeFactory import NodeFactory

app = Sanic("chaiNNer")
CORS(app)


@app.route('/nodes')
async def test(request):
    registry = NodeFactory.get_registry()
    output = []
    for category in registry:
        category_object = {'category': category, 'nodes': []}
        for node in registry[category]:
            # node_object = NodeFactory.create_node(category, node)
            category_object['nodes'].append({'name': node})
        output.append(category_object)
    return json(output)


if __name__ == '__main__':
    app.run()