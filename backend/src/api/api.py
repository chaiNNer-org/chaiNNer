from __future__ import annotations

import importlib
import os
from dataclasses import dataclass, field
from typing import (
    Awaitable,
    Callable,
    Generic,
    Iterable,
    NewType,
    TypedDict,
    TypeVar,
    Union,
)

from sanic.log import logger

import navi

from .group import Group, GroupId, NestedGroup, NestedIdGroup
from .input import BaseInput
from .node_check import (
    NAME_CHECK_LEVEL,
    TYPE_CHECK_LEVEL,
    CheckFailedError,
    CheckLevel,
    check_naming_conventions,
    check_schema_types,
)
from .output import BaseOutput
from .settings import SettingsJson, get_execution_options
from .types import InputId, NodeId, NodeType, OutputId, RunFn

KB = 1024**1
MB = 1024**2
GB = 1024**3


def _process_inputs(base_inputs: Iterable[BaseInput | NestedGroup]):
    inputs: list[BaseInput] = []
    groups: list[NestedIdGroup] = []

    def add_inputs(
        current: Iterable[BaseInput | NestedGroup],
    ) -> list[InputId | NestedIdGroup]:
        layout: list[InputId | NestedIdGroup] = []

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
    outputs: list[BaseOutput] = []
    for i, output_value in enumerate(base_outputs):
        if output_value.id == -1:
            output_value.id = OutputId(i)
        outputs.append(output_value)
    return outputs


class DefaultNode(TypedDict):
    schemaId: str


class IteratorInputInfo:
    def __init__(
        self,
        inputs: int | InputId | list[int] | list[InputId] | list[int | InputId],
        length_type: navi.ExpressionJson = "uint",
    ) -> None:
        self.inputs: list[InputId] = (
            [InputId(x) for x in inputs]
            if isinstance(inputs, list)
            else [InputId(inputs)]
        )
        self.length_type: navi.ExpressionJson = length_type


class IteratorOutputInfo:
    def __init__(
        self,
        outputs: int | OutputId | list[int] | list[OutputId] | list[int | OutputId],
        length_type: navi.ExpressionJson = "uint",
    ) -> None:
        self.outputs: list[OutputId] = (
            [OutputId(x) for x in outputs]
            if isinstance(outputs, list)
            else [OutputId(outputs)]
        )
        self.length_type: navi.ExpressionJson = length_type


@dataclass(frozen=True)
class NodeData:
    schema_id: str
    description: str
    see_also: list[str]
    name: str
    icon: str
    type: NodeType

    inputs: list[BaseInput]
    outputs: list[BaseOutput]
    group_layout: list[InputId | NestedIdGroup]

    iterator_inputs: list[IteratorInputInfo]
    iterator_outputs: list[IteratorOutputInfo]

    side_effects: bool
    deprecated: bool
    features: list[FeatureId]

    run: RunFn

    @property
    def single_iterator_input(self) -> IteratorInputInfo:
        assert len(self.iterator_inputs) == 1
        return self.iterator_inputs[0]

    @property
    def single_iterator_output(self) -> IteratorOutputInfo:
        assert len(self.iterator_outputs) == 1
        return self.iterator_outputs[0]


T = TypeVar("T", bound=RunFn)
S = TypeVar("S")


@dataclass
class NodeGroup:
    category: Category
    id: str
    name: str
    order: list[str | NodeId] = field(default_factory=list)
    nodes: list[NodeData] = field(default_factory=list)

    def add_node(self, node: NodeData):
        logger.debug(f"Added {node.schema_id}")
        self.nodes.append(node)

    def to_dict(self):
        return {
            "id": self.id,
            "category": self.category.id,
            "name": self.name,
            "order": self.order,
        }

    def register(
        self,
        schema_id: str,
        name: str,
        description: str | list[str],
        inputs: list[BaseInput | NestedGroup],
        outputs: list[BaseOutput],
        icon: str = "BsQuestionCircleFill",
        node_type: NodeType = "regularNode",
        side_effects: bool = False,
        deprecated: bool = False,
        decorators: list[Callable] | None = None,
        see_also: list[str] | str | None = None,
        features: list[FeatureId] | FeatureId | None = None,
        limited_to_8bpc: bool | str = False,
        iterator_inputs: list[IteratorInputInfo] | IteratorInputInfo | None = None,
        iterator_outputs: list[IteratorOutputInfo] | IteratorOutputInfo | None = None,
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

        def to_list(x: list[S] | S | None) -> list[S]:
            if x is None:
                return []
            if isinstance(x, list):
                return x
            return [x]

        see_also = to_list(see_also)
        features = to_list(features)

        iterator_inputs = to_list(iterator_inputs)
        iterator_outputs = to_list(iterator_outputs)

        if node_type == "collector":
            assert len(iterator_inputs) == 1 and len(iterator_outputs) == 0
        elif node_type == "newIterator":
            assert len(iterator_inputs) == 0 and len(iterator_outputs) == 1
        else:
            assert len(iterator_inputs) == 0 and len(iterator_outputs) == 0

        def run_check(level: CheckLevel, run: Callable[[bool], None]):
            if level == CheckLevel.NONE:
                return

            try:
                run(level == CheckLevel.FIX)
            except CheckFailedError as e:
                full_error_message = f"Error in {schema_id}: {e}"
                if level == CheckLevel.ERROR:
                    raise CheckFailedError(full_error_message)  # noqa: B904
                logger.warning(full_error_message)

        def inner_wrapper(wrapped_func: T) -> T:
            p_inputs, group_layout = _process_inputs(inputs)
            p_outputs = _process_outputs(outputs)

            if node_type == "regularNode":
                run_check(
                    TYPE_CHECK_LEVEL,
                    lambda _: check_schema_types(wrapped_func, p_inputs, p_outputs),
                )
            run_check(
                NAME_CHECK_LEVEL,
                lambda fix: check_naming_conventions(wrapped_func, name, fix),
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
                iterator_inputs=iterator_inputs,
                iterator_outputs=iterator_outputs,
                side_effects=side_effects,
                deprecated=deprecated,
                features=features,
                run=wrapped_func,
            )

            self.add_node(node)
            return wrapped_func

        return inner_wrapper


@dataclass
class Category:
    package: Package
    id: str
    name: str
    description: str
    icon: str = "BsQuestionCircleFill"
    color: str = "#777777"
    install_hint: str | None = None
    node_groups: list[NodeGroup] = field(default_factory=list)

    def add_node_group(self, name: str) -> NodeGroup:
        result = NodeGroup(
            category=self,
            id=self.id + "/" + name.lower(),
            name=name,
        )
        self.node_groups.append(result)
        return result

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "color": self.color,
            "installHint": self.install_hint,
            "groups": [g.to_dict() for g in self.node_groups],
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

    def to_dict(self):
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

    def to_dict(self):
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
    def enabled(details: str | None = None) -> FeatureState:
        return FeatureState(is_enabled=True, details=details)

    @staticmethod
    def disabled(details: str | None = None) -> FeatureState:
        return FeatureState(is_enabled=False, details=details)


@dataclass
class ToggleSetting:
    label: str
    key: str
    description: str
    default: bool = False
    disabled: bool = False
    type: str = "toggle"


class DropdownOption(TypedDict):
    label: str
    value: str


@dataclass
class DropdownSetting:
    label: str
    key: str
    description: str
    options: list[DropdownOption]
    default: str
    disabled: bool = False
    type: str = "dropdown"


@dataclass
class NumberSetting:
    label: str
    key: str
    description: str
    min: float
    max: float
    default: float = 0
    disabled: bool = False
    type: str = "number"


@dataclass
class CacheSetting:
    label: str
    key: str
    description: str
    directory: str
    default: str = ""
    disabled: bool = False
    type: str = "cache"


Setting = Union[ToggleSetting, DropdownSetting, NumberSetting, CacheSetting]


class SettingsParser:
    def __init__(self, raw: SettingsJson) -> None:
        self.__settings = raw

    def get_bool(self, key: str, default: bool) -> bool:
        value = self.__settings.get(key, default)
        if isinstance(value, bool):
            return value
        raise ValueError(f"Invalid bool value for {key}: {value}")

    def get_int(self, key: str, default: int, parse_str: bool = False) -> int:
        value = self.__settings.get(key, default)
        if parse_str and isinstance(value, str):
            return int(value)
        if isinstance(value, int) and not isinstance(value, bool):
            return value
        raise ValueError(f"Invalid str value for {key}: {value}")

    def get_str(self, key: str, default: str) -> str:
        value = self.__settings.get(key, default)
        if isinstance(value, str):
            return value
        raise ValueError(f"Invalid str value for {key}: {value}")

    def get_cache_location(self, key: str) -> str | None:
        value = self.__settings.get(key)
        if isinstance(value, str) or value is None:
            return value or None
        raise ValueError(f"Invalid cache location value for {key}: {value}")


@dataclass
class Package:
    where: str
    id: str
    name: str
    description: str
    icon: str
    color: str
    dependencies: list[Dependency] = field(default_factory=list)
    categories: list[Category] = field(default_factory=list)
    features: list[Feature] = field(default_factory=list)
    settings: list[Setting] = field(default_factory=list)

    def add_category(
        self,
        name: str,
        description: str,
        icon: str,
        color: str,
        install_hint: str | None = None,
    ) -> Category:
        result = Category(
            package=self,
            id=name.lower(),
            name=name,
            description=description,
            icon=icon,
            color=color,
            install_hint=install_hint,
        )
        self.categories.append(result)
        return result

    def add_dependency(self, dependency: Dependency):
        self.dependencies.append(dependency)

    def add_setting(self, setting: Setting):
        self.settings.append(setting)

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

    def get_settings(self) -> SettingsParser:
        return SettingsParser(get_execution_options().get_package_settings(self.id))


def _iter_py_files(directory: str):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                yield os.path.join(root, file)


@dataclass
class LoadErrorInfo:
    module: str
    file: str
    error: Exception


class PackageRegistry:
    def __init__(self) -> None:
        self.packages: dict[str, Package] = {}
        self.categories: list[Category] = []
        self.nodes: dict[str, tuple[NodeData, NodeGroup]] = {}

    def get_node(self, schema_id: str) -> NodeData:
        return self.nodes[schema_id][0]

    def add(self, package: Package) -> Package:
        # assert package.where not in self.packages
        self.packages[package.where] = package
        return package

    def load_nodes(self, current_file: str) -> list[LoadErrorInfo]:
        load_error: list[LoadErrorInfo] = []
        failed_checks: list[CheckFailedError] = []

        for package in list(self.packages.values()):
            for file_path in _iter_py_files(os.path.dirname(package.where)):
                _, name = os.path.split(file_path)

                if not name.startswith("_"):
                    module = os.path.relpath(file_path, os.path.dirname(current_file))
                    module = module.replace("/", ".").replace("\\", ".")[: -len(".py")]
                    try:
                        importlib.import_module(module, package=None)
                    except CheckFailedError as e:
                        logger.error(e)
                        failed_checks.append(e)
                    except Exception as e:
                        load_error.append(LoadErrorInfo(module, file_path, e))

        if len(failed_checks) > 0:
            raise RuntimeError(f"Checks failed in {len(failed_checks)} node(s)")

        self._refresh_nodes()

        return load_error

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
    dependencies: list[Dependency] | None = None,
    icon: str = "BsQuestionCircleFill",
    color: str = "#777777",
) -> Package:
    return registry.add(
        Package(
            where=where,
            id=id,
            name=name,
            description=description,
            icon=icon,
            color=color,
            dependencies=dependencies or [],
        )
    )


I = TypeVar("I")
L = TypeVar("L")


@dataclass
class Iterator(Generic[I]):
    iter_supplier: Callable[[], Iterable[I]]
    expected_length: int
    defer_errors: bool = False

    @staticmethod
    def from_iter(
        iter_supplier: Callable[[], Iterable[I]],
        expected_length: int,
        defer_errors: bool = False,
    ) -> Iterator[I]:
        def wrapped_supplier():
            errors = []
            for x in iter_supplier():
                try:
                    yield x
                except Exception as e:
                    if defer_errors:
                        errors.append(str(e))
                    else:
                        raise e
            Iterator.__throw_errors(errors)

        return Iterator(wrapped_supplier, expected_length, defer_errors=defer_errors)

    @staticmethod
    def from_list(
        l: list[L], map_fn: Callable[[L, int], I], defer_errors: bool = False
    ) -> Iterator[I]:
        """
        Creates a new iterator from a list that is mapped using the given
        function. The iterable will be equivalent to `map(map_fn, l)`.
        """

        errors = []

        def supplier():
            for i, x in enumerate(l):
                try:
                    yield map_fn(x, i)
                except Exception as e:
                    if defer_errors:
                        errors.append(str(e))
                    else:
                        raise e
            Iterator.__throw_errors(errors)

        return Iterator(supplier, len(l), defer_errors=defer_errors)

    @staticmethod
    def from_range(
        count: int, map_fn: Callable[[int], I], defer_errors: bool = False
    ) -> Iterator[I]:
        """
        Creates a new iterator the given number of items where each item is
        lazily evaluated. The iterable will be equivalent to `map(map_fn, range(count))`.
        """
        assert count >= 0

        errors = []

        def supplier():
            for i in range(count):
                try:
                    yield map_fn(i)
                except Exception as e:
                    if defer_errors:
                        errors.append(str(e))
                    else:
                        raise e
            Iterator.__throw_errors(errors)

        return Iterator(supplier, count, defer_errors=defer_errors)

    @staticmethod
    def __throw_errors(errors: list[str]):
        if len(errors) > 0:
            error_string = "- " + "\n- ".join(errors)
            raise Exception(f"Errors occurred during iteration:\n{error_string}")


N = TypeVar("N")
R = TypeVar("R")


@dataclass
class Collector(Generic[N, R]):
    on_iterate: Callable[[N], None]
    on_complete: Callable[[], R]
