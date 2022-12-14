from typing import Dict, TypeVar

from sanic.log import logger

from .api.package import Package

T = TypeVar("T", bound=Package)

# Implementation based on https://medium.com/@geoffreykoh/implementing-the-factory-pattern-via-dynamic-registry-and-python-decorators-479fc1537bbe
class PackageRegistry:
    """The factory class for creating nodes"""

    registry: Dict[str, Package] = {}
    """ Internal registry for available nodes """

    __pkg_cache: Dict[str, Package] = {}

    @classmethod
    def get_package(cls, name: str) -> Package:
        """Factory command to create the node"""

        package = cls.__pkg_cache.get(name)
        if package is None:
            package_class = cls.registry[name]
            package = package_class
            cls.__pkg_cache[name] = package
        return package

    @classmethod
    def register(cls, package: Package):
        name = package.name
        if name not in cls.registry:
            cls.registry[name] = package
        else:
            logger.warning(f"Package {name} already exists. Will ignore it")
        return package

    @classmethod
    def get_registry(cls):
        return cls.registry
