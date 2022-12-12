from .image import category as image_category
from ..api.package import Package

builtin = Package(
    name="chaiNNer",
    description="chaiNNer's built-in nodes",
    categories=[image_category],
    dependencies=[],
)
