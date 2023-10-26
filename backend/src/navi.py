from __future__ import annotations

import math
from typing import List, Literal, Optional, TypedDict, Union

NumberJson = Union[int, float, Literal["inf"], Literal["-inf"], Literal["NaN"]]


def to_number_json(n: Union[int, float]) -> NumberJson:
    if math.isnan(n):
        return "NaN"
    if n == float("inf"):
        return "inf"
    if n == float("-inf"):
        return "-inf"
    return n


def from_number_json(n: NumberJson) -> Union[int, float]:
    if n == "NaN":
        return float("nan")
    if n == "inf":
        return float("inf")
    if n == "-inf":
        return float("-inf")
    return n


ExpressionJson = Union[
    str,
    int,
    bool,
    "NumericLiteralTypeJson",
    "IntervalTypeJson",
    "IntIntervalTypeJson",
    "StringLiteralTypeJson",
    "UnionExpressionJson",
    "IntersectionExpressionJson",
    "NamedExpressionJson",
    "FieldAccessExpressionJson",
    "FunctionCallExpressionJson",
    "MatchExpressionJson",
    List["ExpressionJson"],
    List[int],
    List[str],
]


class NumericLiteralTypeJson(TypedDict):
    type: Literal["numeric-literal"]
    value: NumberJson


class IntervalTypeJson(TypedDict):
    type: Literal["interval"]
    min: NumberJson
    max: NumberJson


class IntIntervalTypeJson(TypedDict):
    type: Literal["int-interval"]
    min: NumberJson
    max: NumberJson


class StringLiteralTypeJson(TypedDict):
    type: Literal["string-literal"]
    value: str


class UnionExpressionJson(TypedDict):
    type: Literal["union"]
    items: list[ExpressionJson]


class IntersectionExpressionJson(TypedDict):
    type: Literal["intersection"]
    items: list[ExpressionJson]


class NamedExpressionJson(TypedDict):
    type: Literal["named"]
    name: str
    fields: dict[str, ExpressionJson] | None


class FieldAccessExpressionJson(TypedDict):
    type: Literal["field-access"]
    of: ExpressionJson
    field: str


class FunctionCallExpressionJson(TypedDict):
    type: Literal["function-call"]
    name: str
    args: list[ExpressionJson]


class MatchArmJson(TypedDict):
    pattern: ExpressionJson
    binding: str | None
    to: ExpressionJson


class MatchExpressionJson(TypedDict):
    type: Literal["match"]
    of: ExpressionJson
    arms: list[MatchArmJson]


def literal(value: Union[str, int, float]) -> ExpressionJson:
    if isinstance(value, str):
        return {
            "type": "string-literal",
            "value": value,
        }
    return {
        "type": "numeric-literal",
        "value": to_number_json(value),
    }


def interval(
    min_value: Union[int, float, None] = None,
    max_value: Union[int, float, None] = None,
) -> ExpressionJson:
    return {
        "type": "interval",
        "min": to_number_json(min_value if min_value is not None else float("-inf")),
        "max": to_number_json(max_value if max_value is not None else float("inf")),
    }


def int_interval(
    min_value: Union[int, float, None] = None,
    max_value: Union[int, float, None] = None,
) -> ExpressionJson:
    return {
        "type": "int-interval",
        "min": to_number_json(min_value if min_value is not None else float("-inf")),
        "max": to_number_json(max_value if max_value is not None else float("inf")),
    }


def union(*items: ExpressionJson) -> ExpressionJson:
    return {"type": "union", "items": list(items)}


def intersect(*items: ExpressionJson) -> ExpressionJson:
    return {"type": "intersection", "items": list(items)}


def named(name: str, fields: dict[str, ExpressionJson] | None = None) -> ExpressionJson:
    return {"type": "named", "name": name, "fields": fields}


def field(of: ExpressionJson, field_name: str) -> ExpressionJson:
    return {"type": "field-access", "of": of, "field": field_name}


def fn(name: str, *args: ExpressionJson) -> ExpressionJson:
    return {"type": "function-call", "name": name, "args": list(args)}


def match(
    of: ExpressionJson,
    *args: tuple[ExpressionJson, str | None, ExpressionJson],
    default: ExpressionJson | None = None,
) -> ExpressionJson:
    arms: list[MatchArmJson] = []
    for pattern, binding, to in args:
        arms.append({"pattern": pattern, "binding": binding, "to": to})
    if default is not None:
        arms.append({"pattern": "any", "binding": None, "to": default})
    return {"type": "match", "of": of, "arms": arms}


def Image(
    width: Optional[ExpressionJson] = None,
    height: Optional[ExpressionJson] = None,
    channels: Optional[ExpressionJson] = None,
    width_as: Optional[ExpressionJson] = None,
    height_as: Optional[ExpressionJson] = None,
    channels_as: Optional[ExpressionJson] = None,
    size_as: Optional[ExpressionJson] = None,
) -> ExpressionJson:
    fields: dict[str, ExpressionJson] = {}
    if width is not None:
        fields["width"] = width
    if height is not None:
        fields["height"] = height
    if channels is not None:
        fields["channels"] = channels
    if width_as is not None:
        fields["width"] = field(width_as, "width")
    if height_as is not None:
        fields["height"] = field(height_as, "height")
    if channels_as is not None:
        fields["channels"] = field(channels_as, "channels")
    if size_as is not None:
        fields["width"] = field(size_as, "width")
        fields["height"] = field(size_as, "height")
    return named("Image", fields)


def Color(
    channels: Optional[ExpressionJson] = None,
    channels_as: Optional[ExpressionJson] = None,
) -> ExpressionJson:
    fields: dict[str, ExpressionJson] = {}
    if channels is not None:
        fields["channels"] = channels
    if channels_as is not None:
        fields["channels"] = field(channels_as, "channels")
    return named("Color", fields)
