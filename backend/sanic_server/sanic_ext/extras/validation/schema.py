from dataclasses import is_dataclass
from inspect import isclass, signature
from typing import (  # type: ignore
    Dict,
    Literal,
    Union,
    _GenericAlias,
    get_args,
    get_origin,
    get_type_hints,
)

from .check import Hint


def make_schema(agg, item):
    if type(item) in (bool, str, int, float):
        return agg
    if isinstance(item, _GenericAlias) and (args := get_args(item)):
        for arg in args:
            make_schema(agg, arg)
    elif item.__name__ not in agg and is_dataclass(item):
        sig = signature(item)
        hints = parse_hints(get_type_hints(item))

        agg[item.__name__] = {
            "sig": sig,
            "hints": hints,
        }

        for hint in hints.values():
            make_schema(agg, hint.hint)

    return agg


def parse_hints(hints) -> Dict[str, Hint]:
    output: Dict[str, Hint] = {
        name: parse_hint(hint) for name, hint in hints.items()
    }
    return output


def parse_hint(hint):
    origin = None
    literal = not isclass(hint)
    nullable = False
    typed = False
    model = False
    allowed = tuple()

    if is_dataclass(hint):
        model = True
    elif isinstance(hint, _GenericAlias):
        typed = True
        literal = False
        origin = get_origin(hint)
        args = get_args(hint)
        nullable = origin == Union and type(None) in args

        if nullable:
            allowed = (args[0],)
        elif origin is dict:
            allowed = (args[1],)
        elif origin is list or origin is Literal or origin is Union:
            allowed = args

    return Hint(
        hint,
        model,
        literal,
        typed,
        nullable,
        origin,
        tuple([parse_hint(item) for item in allowed]),
    )
