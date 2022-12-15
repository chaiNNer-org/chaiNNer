from typing import Dict, TypeVar

from sanic.log import logger

from .api.node_base import NodeBase

from .api.package import Package

T = TypeVar("T", bound=Package)

# Implementation based on https://medium.com/@geoffreykoh/implementing-the-factory-pattern-via-dynamic-registry-and-python-decorators-479fc1537bbe
class PackageRegistry:
    """The factory class for creating nodes"""

    package_registry: Dict[str, Package] = {}
    node_registry: Dict[str, NodeBase] = {}

    __pkg_cache: Dict[str, Package] = {}
    __node_cache: Dict[str, NodeBase] = {}

    @classmethod
    def get_package(cls, name: str) -> Package:
        package = cls.__pkg_cache.get(name)
        if package is None:
            package_class = cls.package_registry[name]
            package = package_class
            cls.__pkg_cache[name] = package
        return package

    @classmethod
    def get_node(cls, schema_id: str) -> NodeBase:
        node = cls.__node_cache.get(schema_id)
        if node is None:
            node_class = cls.node_registry[schema_id]
            node = node_class
            cls.__node_cache[schema_id] = node
        return node

    @classmethod
    def register(cls, package: Package):
        name = package.name
        if name not in cls.package_registry:
            cls.package_registry[name] = package
            for category in package.categories:
                for sub_category in category.sub_categories:
                    for node in sub_category.nodes:
                        cls.node_registry[
                            node.get_schema_id(package.author, name)
                        ] = node
        else:
            logger.warning(f"Package {name} already exists. Will ignore it")
        return package

    @classmethod
    def get_registry(cls):
        return cls.package_registry
