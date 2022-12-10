from . import image
from ..api.package import Package

builtin = Package(
    name="chaiNNer",
    description="chaiNNer's built-in nodes",
    categories=[image.category],
)
