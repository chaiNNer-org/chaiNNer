from ...package_registry import PackageRegistry
from .image import category as image_category
from ...api.package import Package


PackageRegistry.register(
    Package(
        author="chainner",
        name="image",
        description="chaiNNer's built-in image nodes",
        categories=[image_category],
        dependencies=[],
    )
)
