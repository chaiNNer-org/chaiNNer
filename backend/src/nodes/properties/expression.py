from typing import Literal, Optional, TypedDict, Union
import math


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
    "NumericLiteralTypeJson",
    "IntervalTypeJson",
    "IntIntervalTypeJson",
    "StringLiteralTypeJson",
    "UnionExpressionJson",
    "IntersectionExpressionJson",
    "NamedExpressionJson",
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
    fields: dict[str, ExpressionJson]


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
    min: Union[int, float, None],
    max: Union[int, float, None],
) -> ExpressionJson:
    return {
        "type": "interval",
        "min": to_number_json(min if min is not None else float("-inf")),
        "max": to_number_json(max if max is not None else float("inf")),
    }


def int_interval(
    min: Union[int, float, None],
    max: Union[int, float, None],
) -> ExpressionJson:
    return {
        "type": "int-interval",
        "min": to_number_json(min if min is not None else float("-inf")),
        "max": to_number_json(max if max is not None else float("inf")),
    }


def union(items: list[ExpressionJson]) -> ExpressionJson:
    return {"type": "union", "items": items}


def intersection(items: list[ExpressionJson]) -> ExpressionJson:
    return {"type": "intersection", "items": items}


def named(name: str, fields: dict[str, ExpressionJson]) -> ExpressionJson:
    return {"type": "named", "name": name, "fields": fields}


def Image(
    width: Optional[ExpressionJson] = None,
    height: Optional[ExpressionJson] = None,
    channels: Optional[ExpressionJson] = None,
) -> ExpressionJson:
    fields: dict[str, ExpressionJson] = {}
    if width is not None:
        fields["width"] = width
    if height is not None:
        fields["height"] = height
    if channels is not None:
        fields["channels"] = channels
    return named("Image", fields)
