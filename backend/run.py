from sanic import Sanic
from sanic.response import json
from sanic_cors import CORS, cross_origin

app = Sanic("My Hello, world app")
CORS(app)

@app.route('/')
async def test(request):
    return json({'hello': 'world'})

if __name__ == '__main__':
    app.run()