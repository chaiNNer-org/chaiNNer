from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Any, Callable, Generic, Mapping, Protocol, TypeVar

import navi

from .group import NestedIdGroup
from .input import BaseInput
from .iter import Generator
from .output import BaseOutput
from .types import (
    FeatureId,
    InputId,
    IterInputId,
    IterOutputId,
    NodeKind,
    OutputId,
    RunFn,
)

if TYPE_CHECKING:
    from .migration import Migration


class IteratorInputInfo:
    def __init__(
        self,
        inputs: int | InputId | list[int] | list[InputId] | list[int | InputId],
        length_type: navi.ExpressionJson = "uint",
    ) -> None:
        self.id: IterInputId = IterInputId(0)
        self.inputs: list[InputId] = (
            [InputId(x) for x in inputs]
            if isinstance(inputs, list)
            else [InputId(inputs)]
        )
        self.length_type: navi.ExpressionJson = length_type

    def to_dict(self):
        return {
            "id": self.id,
            "inputs": self.inputs,
            "sequenceType": navi.named("Sequence", {"length": self.length_type}),
        }


M_co = TypeVar("M_co", covariant=True)


class AnyConstructor(Protocol, Generic[M_co]):
    def __call__(self, *args: Any, **kwargs: Any) -> M_co: ...


class IteratorOutputInfo:
    def __init__(
        self,
        outputs: int | OutputId | list[int] | list[OutputId] | list[int | OutputId],
        length_type: navi.ExpressionJson = "uint",
    ) -> None:
        self.id: IterOutputId = IterOutputId(0)
        self.outputs: list[OutputId] = (
            [OutputId(x) for x in outputs]
            if isinstance(outputs, list)
            else [OutputId(outputs)]
        )
        self.length_type: navi.ExpressionJson = length_type

        self._metadata_constructor: Any | None = None
        self._item_types_fn: (
            Callable[[Any], Mapping[OutputId, navi.ExpressionJson]] | None
        ) = None

    def with_item_types(
        self,
        class_: AnyConstructor[M_co],
        fn: Callable[[M_co], Mapping[OutputId, navi.ExpressionJson]],
    ):
        self._metadata_constructor = class_
        self._item_types_fn = fn
        return self

    def to_dict(self):
        return {
            "id": self.id,
            "outputs": self.outputs,
            "sequenceType": navi.named("Sequence", {"length": self.length_type}),
        }

    def get_broadcast_sequence_type(self, generator: Generator) -> navi.ExpressionJson:
        return navi.named("Sequence", {"length": generator.expected_length})

    def get_broadcast_item_types(
        self, generator: Generator
    ) -> Mapping[OutputId, navi.ExpressionJson]:
        if self._item_types_fn is not None and self._metadata_constructor is not None:
            metadata = generator.metadata
            if isinstance(metadata, self._metadata_constructor):
                return self._item_types_fn(metadata)
        return {}


class KeyInfo:
    def __init__(self, data: dict[str, Any]) -> None:
        self._data = data

    @staticmethod
    def enum(enum_input: InputId | int) -> KeyInfo:
        return KeyInfo({"kind": "enum", "inputId": enum_input})

    @staticmethod
    def number(number_input: InputId | int) -> KeyInfo:
        return KeyInfo({"kind": "number", "inputId": number_input})

    @staticmethod
    def type(expression: navi.ExpressionJson) -> KeyInfo:
        return KeyInfo({"kind": "type", "expression": expression})

    def to_dict(self):
        return self._data


class SpecialSuggestion:
    """
    A special suggestion in chaiNNer's context node selector.

    A suggestion consists of 3 parts:
    1.  The search query to match. The query may optionally contain a pattern at the end
        to supply a value to an input. E.g. `+{2}` will match the search query "+123"
        and "123" will be parsed for the input with ID 2.
    2.  The name of the suggestion. This is the text that will be displayed in the
        suggestion list.
    3.  The input values to supply to the node. This is a mapping of input IDs to the
        values to supply to them. Values that aren't defined here will be left as
        default values.
    """

    def __init__(
        self,
        query: str,
        *,
        name: str | None = None,
        inputs: Mapping[InputId | int, Any] = {},
    ) -> None:
        self.query, self.parse_input = SpecialSuggestion._parse_query(query)
        self.name = name
        self.inputs: dict[InputId, Any] = {InputId(k): v for k, v in inputs.items()}

    @staticmethod
    def _parse_query(query: str) -> tuple[str, InputId | None]:
        # e.g. "+{2}"
        if "{" in query:
            query, input_id = query.split("{")
            input_id = int(input_id[:-1])
            return query, InputId(input_id)
        return query, None

    def to_dict(self):
        def convert_value(value: Any) -> Any:
            if isinstance(value, bool):
                return int(value)
            if isinstance(value, Enum):
                return value.value
            return value

        return {
            "query": self.query,
            "name": self.name,
            "parseInput": self.parse_input,
            "inputs": {k: convert_value(v) for k, v in self.inputs.items()},
        }


@dataclass(frozen=True)
class NodeData:
    schema_id: str
    description: str
    see_also: list[str]
    name: str
    icon: str
    kind: NodeKind

    inputs: list[BaseInput]
    outputs: list[BaseOutput]
    group_layout: list[InputId | NestedIdGroup]

    iterable_inputs: list[IteratorInputInfo]
    iterable_outputs: list[IteratorOutputInfo]

    key_info: KeyInfo | None
    suggestions: list[SpecialSuggestion]

    side_effects: bool
    deprecated: bool
    node_context: bool
    features: list[FeatureId]
    
    migrations: list[Migration]

    run: RunFn

    @property
    def single_iterable_input(self) -> IteratorInputInfo:
        assert len(self.iterable_inputs) == 1
        return self.iterable_inputs[0]

    @property
    def single_iterable_output(self) -> IteratorOutputInfo:
        assert len(self.iterable_outputs) == 1
        return self.iterable_outputs[0]
