from __future__ import annotations

import importlib
import os
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Tuple, TypeVar, Union

from sanic.log import logger

from base_types import InputId, OutputId
from nodes.group import Group, GroupId, NestedGroup, NestedIdGroup
from nodes.node_base import NodeType
from nodes.properties.inputs.base_input import BaseInput
from nodes.properties.outputs.base_output import BaseOutput


@dataclass
class Node:
    schema_id: str = ""
    description: str = ""
    name: str = ""
    icon: str = ""
    type: NodeType | None = "regularNode"

    inputs: List[BaseInput] = field(default_factory=list)
    outputs: List[BaseOutput] = field(default_factory=list)
    group_layout: List[Union[InputId, NestedIdGroup]] = field(default_factory=list)

    side_effects: bool = False
    deprecated: bool = False
    default_nodes: List["Node"] | None = None  # For iterators only

    run: Callable[[], Any] = lambda: None

    def set_inputs(self, value: List[Union[BaseInput, NestedGroup]]):
        _inputs: List[BaseInput] = []
        _groups = []

        def add_inputs(
            current: List[Union[BaseInput, NestedGroup]]
        ) -> List[Union[InputId, NestedIdGroup]]:
            layout: List[Union[InputId, NestedIdGroup]] = []

            for x in current:
                if isinstance(x, Group):
                    if x.info.id == -1:
                        x.info.id = GroupId(len(_groups))
                    g: NestedIdGroup = Group(x.info, [])
                    _groups.append(g)
                    layout.append(g)
                    g.items.extend(add_inputs(x.items))  # type: ignore
                else:
                    if x.id == -1:
                        x.id = InputId(len(_inputs))
                    layout.append(x.id)
                    _inputs.append(x)

            return layout

        self.inputs = _inputs
        self.group_layout = add_inputs(value)

    def set_outputs(self, value: List[BaseOutput]):
        for i, output_value in enumerate(value):
            if output_value.id == -1:
                output_value.id = OutputId(i)
        self.outputs = value

    def set_run(self, value: Callable[[], Any]):
        self.run = value


T = TypeVar("T", bound=Node)


@dataclass
class NodeGroup:
    category: Category
    name: str
    nodes: List[Node] = field(default_factory=list)

    def add_node(
        self,
        node: Node,
    ):

        logger.info(f"Added {node.schema_id}")
        self.nodes.append(node)

    def register(
        self,
        schema_id: str,
        name: str,
        description: str,
        icon: str = "BsQuestionCircleFill",
        node_type: NodeType | None = "regularNode",
        inputs: List[Union[BaseInput, NestedGroup]] | None = None,
        outputs: List[BaseOutput] | None = None,
        side_effects: bool = False,
        deprecated: bool = False,
        default_nodes: Any | None = None,
    ):
        def inner_wrapper(wrapped_func: Any) -> Any:
            node = Node(
                schema_id=schema_id,
                name=name,
                description=description,
                icon=icon,
                type=node_type,
                side_effects=side_effects,
                deprecated=deprecated,
                default_nodes=default_nodes,
            )
            node.set_inputs(inputs or [])
            node.set_outputs(outputs or [])
            node.set_run(wrapped_func)
            self.add_node(node)
            return wrapped_func

        return inner_wrapper


@dataclass
class Category:
    package: Package
    name: str
    description: str
    icon: str = "BsQuestionCircleFill"
    color: str = "#777777"
    install_hint: str | None = None
    node_groups: List["NodeGroup"] = field(default_factory=list)

    def add_node_group(self, name: str) -> "NodeGroup":
        result = NodeGroup(category=self, name=name)
        self.node_groups.append(result)
        return result

    def toDict(self):
        return {
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "color": self.color,
            "installHint": self.install_hint,
        }


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


def _iter_py_files(directory: str):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                yield os.path.join(root, file)


class PackageRegistry:
    def __init__(self) -> None:
        self.packages: Dict[str, Package] = {}
        self.categories: List[Category] = []
        self.nodes: Dict[str, Tuple[Node, NodeGroup]] = {}

    def get_node(self, schema_id: str) -> Node:
        return self.nodes[schema_id][0]

    def add(self, package: Package) -> Package:
        # assert package.where not in self.packages
        self.packages[package.where] = package
        return package

    def load_nodes(self, current_file: str):
        import_errors: List[ImportError] = []

        for package in self.packages.values():
            for file_path in _iter_py_files(os.path.dirname(package.where)):
                _, name = os.path.split(file_path)

                if not name.startswith("_"):
                    module = os.path.relpath(file_path, os.path.dirname(current_file))
                    logger.info(module)
                    module = module.replace("/", ".").replace("\\", ".")[: -len(".py")]
                    logger.info(module)
                    try:
                        importlib.import_module(module, package=None)
                    except ImportError as e:
                        import_errors.append(e)

        logger.info(import_errors)
        self._refresh_nodes()

        return import_errors

    def _refresh_nodes(self):
        self.nodes = {}
        self.categories = []

        for package in self.packages.values():
            self.categories.extend(package.categories)
            for category in package.categories:
                for sub in category.node_groups:
                    for node in sub.nodes:
                        if node.schema_id in self.nodes:
                            # print warning
                            pass
                        self.nodes[node.schema_id] = node, sub


registry = PackageRegistry()


def add_package(where: str, name: str, dependencies: List[str]) -> Package:
    return registry.add(Package(where, name, dependencies))
