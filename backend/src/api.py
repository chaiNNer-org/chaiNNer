from __future__ import annotations

import importlib
import os
from dataclasses import dataclass, field
from typing import (
    Awaitable,
    Callable,
    Dict,
    Iterable,
    List,
    NewType,
    Tuple,
    TypedDict,
    TypeVar,
)

from sanic.log import logger

from base_types import InputId, OutputId
from custom_types import NodeType, RunFn
from node_check import (
    NAME_CHECK_LEVEL,
    TYPE_CHECK_LEVEL,
    CheckFailedError,
    CheckLevel,
    check_naming_conventions,
    check_schema_types,
)
from nodes.base_input import BaseInput
from nodes.base_output import BaseOutput
from nodes.group import Group, GroupId, NestedGroup, NestedIdGroup

KB = 1024**1
MB = 1024**2
GB = 1024**3


def _process_inputs(base_inputs: Iterable[BaseInput | NestedGroup]):
    inputs: List[BaseInput] = []
    groups: List[NestedIdGroup] = []

    def add_inputs(
        current: Iterable[BaseInput | NestedGroup],
    ) -> List[InputId | NestedIdGroup]:
        layout: List[InputId | NestedIdGroup] = []

        for x in current:
            if isinstance(x, Group):
                if x.info.id == -1:
                    x.info.id = GroupId(len(groups))
                g: NestedIdGroup = Group(x.info, [])
                groups.append(g)
                layout.append(g)
                g.items.extend(add_inputs(x.items))  # type: ignore
            else:
                if x.id == -1:
                    x.id = InputId(len(inputs))
                layout.append(x.id)
                inputs.append(x)

        return layout

    return inputs, add_inputs(base_inputs)


def _process_outputs(base_outputs: Iterable[BaseOutput]):
    outputs: List[BaseOutput] = []
    for i, output_value in enumerate(base_outputs):
        if output_value.id == -1:
            output_value.id = OutputId(i)
        outputs.append(output_value)
    return outputs


class DefaultNode(TypedDict):
    schemaId: str


@dataclass(frozen=True)
class NodeData:
    schema_id: str
    description: str
    see_also: List[str]
    name: str
    icon: str
    type: NodeType

    inputs: List[BaseInput]
    outputs: List[BaseOutput]
    group_layout: List[InputId | NestedIdGroup]

    side_effects: bool
    deprecated: bool
    default_nodes: List[DefaultNode] | None  # For iterators only
    features: List[FeatureId]

    run: RunFn


T = TypeVar("T", bound=RunFn)
S = TypeVar("S")


@dataclass
class NodeGroup:
    category: Category
    name: str
    nodes: List[NodeData] = field(default_factory=list)

    def add_node(self, node: NodeData):
        logger.debug(f"Added {node.schema_id}")
        self.nodes.append(node)

    def register(
        self,
        schema_id: str,
        name: str,
        description: str | List[str],
        inputs: List[BaseInput | NestedGroup],
        outputs: List[BaseOutput],
        icon: str = "BsQuestionCircleFill",
        node_type: NodeType = "regularNode",
        side_effects: bool = False,
        deprecated: bool = False,
        default_nodes: List[DefaultNode] | None = None,
        decorators: List[Callable] | None = None,
        see_also: List[str] | str | None = None,
        features: List[FeatureId] | FeatureId | None = None,
        limited_to_8bpc: bool | str = False,
    ):
        if not isinstance(description, str):
            description = "\n\n".join(description)

        if limited_to_8bpc:
            description += "\n\n#### Limited color depth\n\n"
            if isinstance(limited_to_8bpc, str):
                description += f" {limited_to_8bpc}"
            else:
                description += (
                    "This node will internally convert input images to 8 bits/channel."
                    " This is generally only a problem if you intend to save the output with 16 bits/channel or higher."
                )

        def to_list(x: List[S] | S | None) -> List[S]:
            if x is None:
                return []
            if isinstance(x, list):
                return x
            return [x]

        see_also = to_list(see_also)
        features = to_list(features)

        def run_check(level: CheckLevel, run: Callable[[bool], None]):
            if level == CheckLevel.NONE:
                return

            try:
                run(level == CheckLevel.FIX)
            except CheckFailedError as e:
                full_error_message = f"Error in {schema_id}: {e}"
                if level == CheckLevel.ERROR:
                    # pylint: disable=raise-missing-from
                    raise CheckFailedError(full_error_message)
                logger.warning(full_error_message)

        def inner_wrapper(wrapped_func: T) -> T:
            p_inputs, group_layout = _process_inputs(inputs)
            p_outputs = _process_outputs(outputs)

            run_check(
                TYPE_CHECK_LEVEL,
                lambda _: check_schema_types(
                    wrapped_func, node_type, p_inputs, p_outputs
                ),
            )
            run_check(
                NAME_CHECK_LEVEL,
                lambda fix: check_naming_conventions(
                    wrapped_func, node_type, name, fix
                ),
            )

            if decorators is not None:
                for decorator in decorators:
                    wrapped_func = decorator(wrapped_func)

            node = NodeData(
                schema_id=schema_id,
                name=name,
                description=description,
                see_also=see_also,
                icon=icon,
                type=node_type,
                inputs=p_inputs,
                group_layout=group_layout,
                outputs=p_outputs,
                side_effects=side_effects,
                deprecated=deprecated,
                default_nodes=default_nodes,
                features=features,
                run=wrapped_func,
            )

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
class Dependency:
    display_name: str
    pypi_name: str
    version: str
    size_estimate: int | float
    auto_update: bool = False
    extra_index_url: str | None = None

    import_name: str | None = None

    def toDict(self):
        return {
            "displayName": self.display_name,
            "pypiName": self.pypi_name,
            "version": self.version,
            "sizeEstimate": int(self.size_estimate),
            "autoUpdate": self.auto_update,
            "findLink": self.extra_index_url,
        }


FeatureId = NewType("FeatureId", str)


@dataclass
class Feature:
    id: str
    name: str
    description: str
    behavior: FeatureBehavior | None = None

    def add_behavior(self, check: Callable[[], Awaitable[FeatureState]]) -> FeatureId:
        if self.behavior is not None:
            raise ValueError("Behavior already set")

        self.behavior = FeatureBehavior(check=check)
        return FeatureId(self.id)

    def toDict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
        }


@dataclass
class FeatureBehavior:
    check: Callable[[], Awaitable[FeatureState]]


@dataclass(frozen=True)
class FeatureState:
    is_enabled: bool
    details: str | None = None

    @staticmethod
    def enabled(details: str | None = None) -> "FeatureState":
        return FeatureState(is_enabled=True, details=details)

    @staticmethod
    def disabled(details: str | None = None) -> "FeatureState":
        return FeatureState(is_enabled=False, details=details)


@dataclass
class Package:
    where: str
    id: str
    name: str
    description: str
    dependencies: List[Dependency] = field(default_factory=list)
    categories: List[Category] = field(default_factory=list)
    features: List[Feature] = field(default_factory=list)

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

    def add_dependency(
        self,
        dependency: Dependency,
    ):
        self.dependencies.append(dependency)

    def add_feature(
        self,
        id: str,  # pylint: disable=redefined-builtin
        name: str,
        description: str,
    ) -> Feature:
        if any(f.id == id for f in self.features):
            raise ValueError(f"Duplicate feature id: {id}")

        feature = Feature(id=id, name=name, description=description)
        self.features.append(feature)
        return feature


def _iter_py_files(directory: str):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                yield os.path.join(root, file)


class PackageRegistry:
    def __init__(self) -> None:
        self.packages: Dict[str, Package] = {}
        self.categories: List[Category] = []
        self.nodes: Dict[str, Tuple[NodeData, NodeGroup]] = {}

    def get_node(self, schema_id: str) -> NodeData:
        return self.nodes[schema_id][0]

    def add(self, package: Package) -> Package:
        # assert package.where not in self.packages
        self.packages[package.where] = package
        return package

    def load_nodes(self, current_file: str):
        import_errors: List[ImportError] = []
        failed_checks: List[CheckFailedError] = []

        for package in list(self.packages.values()):
            for file_path in _iter_py_files(os.path.dirname(package.where)):
                _, name = os.path.split(file_path)

                if not name.startswith("_"):
                    module = os.path.relpath(file_path, os.path.dirname(current_file))
                    module = module.replace("/", ".").replace("\\", ".")[: -len(".py")]
                    try:
                        importlib.import_module(module, package=None)
                    except ImportError as e:
                        import_errors.append(e)
                    except RuntimeError as e:
                        logger.warning(f"Failed to load {module} ({file_path}): {e}")
                    except ValueError as e:
                        logger.warning(f"Failed to load {module} ({file_path}): {e}")
                    except CheckFailedError as e:
                        logger.error(e)
                        failed_checks.append(e)

        if len(failed_checks) > 0:
            raise RuntimeError(f"Checks failed in {len(failed_checks)} node(s)")

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


def add_package(
    where: str,
    id: str,  # pylint: disable=redefined-builtin
    name: str,
    description: str,
    dependencies: List[Dependency] | None = None,
) -> Package:
    return registry.add(
        Package(
            where=where,
            id=id,
            name=name,
            description=description,
            dependencies=dependencies or [],
        )
    )
