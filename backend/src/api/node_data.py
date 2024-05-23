from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Mapping

import navi

from .group import NestedIdGroup
from .input import BaseInput
from .output import BaseOutput
from .types import FeatureId, InputId, NodeKind, OutputId, RunFn


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

    def to_dict(self):
        return {
            "inputs": self.inputs,
            "lengthType": self.length_type,
        }


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

    def to_dict(self):
        return {
            "outputs": self.outputs,
            "lengthType": self.length_type,
        }


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

    iterator_inputs: list[IteratorInputInfo]
    iterator_outputs: list[IteratorOutputInfo]

    key_info: KeyInfo | None
    suggestions: list[SpecialSuggestion]

    side_effects: bool
    deprecated: bool
    node_context: bool
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
