from ...package_registry import PackageRegistry
from .utility import category as utility_category
from ...api.package import Package


PackageRegistry.register(
    Package(
        author="chainner",
        name="utility",
        description="chaiNNer's built-in utility nodes",
        categories=[utility_category],
        dependencies=[],
    )
)
