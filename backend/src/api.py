from __future__ import annotations

import importlib
import os
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Tuple, TypeVar

from sanic.log import logger

from nodes.node_base import NodeBase


@dataclass
class Package:
    where: str
    name: str
    dependencies: List[str] = field(default_factory=list)
    categories: List[Category] = field(default_factory=list)

    def add_category(
        self,
        name: str,
        description: str,
        icon: str,
        color: str,
        install_hint: str | None = None,
    ) -> "Category":
        result = Category(
            package=self,
            name=name,
            description=description,
            icon=icon,
            color=color,
            install_hint=install_hint,
        )
        self.categories.append(result)
        return result


@dataclass
class Category:
    package: Package
    name: str
    description: str
    icon: str = "BsQuestionCircleFill"
    color: str = "#777777"
    install_hint: str | None = None
    sub_categories: List["SubCategory"] = field(default_factory=list)

    def add_sub_category(self, name: str) -> "SubCategory":
        result = SubCategory(category=self, name=name)
        self.sub_categories.append(result)
        return result

    def toDict(self):
        return {
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "color": self.color,
            "installHint": self.install_hint,
        }


T = TypeVar("T", bound=NodeBase)


@dataclass
class SubCategory:
    category: Category
    name: str
    nodes: List[NodeBase] = field(default_factory=list)

    def add_node(self, node: NodeBase):
        logger.info(f"Added {node.schema_id}")
        self.nodes.append(node)

    def register(self):
        def inner_wrapper(wrapped_class: Callable[[], T]) -> Callable[[], T]:
            self.add_node(wrapped_class())
            return wrapped_class

        return inner_wrapper


def _iter_py_files(directory: str):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                yield os.path.join(root, file)


class PackageRegistry:
    def __init__(self) -> None:
        self.packages: Dict[str, Package] = {}
        self.categories: List[Category] = []
        self.nodes: Dict[str, Tuple[NodeBase, SubCategory]] = {}

    def get_node(self, schema_id: str) -> NodeBase:
        return self.nodes[schema_id][0]

    def add(self, package: Package) -> Package:
        # assert package.where not in self.packages
        self.packages[package.where] = package
        return package

    def load_nodes(self, current_file: str):
        import_errors: List[ImportError] = []

        # for package in self.packages.values():
        #     for file_path in _iter_py_files(os.path.dirname(package.where)):
        #         _, name = os.path.split(file_path)

        #         if not name.startswith("_"):
        #             module = os.path.relpath(file_path, os.path.dirname(current_file))
        #             logger.info(module)
        #             module = module.replace("/", ".").replace("\\", ".")[: -len(".py")]
        #             logger.info(module)
        #             try:
        #                 importlib.import_module(module, package=None)
        #             except ImportError as e:
        #                 import_errors.append(e)

        logger.info(import_errors)
        self._refresh_nodes()

        return import_errors

    def _refresh_nodes(self):
        self.nodes = {}
        self.categories = []

        for package in self.packages.values():
            self.categories.extend(package.categories)
            for category in package.categories:
                for sub in category.sub_categories:
                    for node in sub.nodes:
                        if node.schema_id in self.nodes:
                            # print warning
                            pass
                        self.nodes[node.schema_id] = node, sub


registry = PackageRegistry()


def add_package(where: str, name: str, dependencies: List[str]) -> Package:
    return registry.add(Package(where, name, dependencies))
