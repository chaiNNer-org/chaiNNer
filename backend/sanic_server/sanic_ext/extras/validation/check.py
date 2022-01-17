from __future__ import annotations

from typing import Any, Literal, NamedTuple, Optional, Tuple, Union


class Hint(NamedTuple):
    hint: Any
    model: bool
    literal: bool
    typed: bool
    nullable: bool
    origin: Optional[Any]
    allowed: Tuple[Hint, ...]  # type: ignore

    def validate(
        self, value, schema, allow_multiple=False, allow_coerce=False
    ):
        if not self.typed:
            if self.model:
                return check_data(
                    self.hint,
                    value,
                    schema,
                    allow_multiple=allow_multiple,
                    allow_coerce=allow_coerce,
                )
            if (
                allow_multiple
                and isinstance(value, list)
                and self.hint is not list
                and len(value) == 1
            ):
                value = value[0]
            try:
                _check_types(value, self.literal, self.hint)
            except ValueError as e:
                if allow_coerce:
                    if isinstance(value, list):
                        value = [self.hint(item) for item in value]
                    else:
                        value = self.hint(value)
                    _check_types(value, self.literal, self.hint)
                else:
                    raise e
        else:
            _check_nullability(value, self.nullable, self.allowed, schema)

            if not self.nullable:
                if self.origin in (Union, Literal):
                    value = _check_inclusion(
                        value,
                        self.allowed,
                        schema,
                        allow_multiple,
                        allow_coerce,
                    )
                elif self.origin is list:
                    value = _check_list(
                        value,
                        self.allowed,
                        self.hint,
                        schema,
                        allow_multiple,
                        allow_coerce,
                    )
                elif self.origin is dict:
                    value = _check_dict(
                        value,
                        self.allowed,
                        self.hint,
                        schema,
                        allow_multiple,
                        allow_coerce,
                    )

        return value


def check_data(model, data, schema, allow_multiple=False, allow_coerce=False):
    if not isinstance(data, dict):
        raise TypeError(f"Value '{data}' is not a dict")
    sig = schema[model.__name__]["sig"]
    hints = schema[model.__name__]["hints"]
    bound = sig.bind(**data)
    bound.apply_defaults()
    params = dict(zip(sig.parameters, bound.args))
    params.update(bound.kwargs)

    hydration_values = {}
    try:
        for key, value in params.items():
            hint = hints.get(key, Any)
            hydration_values[key] = hint.validate(
                value,
                schema,
                allow_multiple=allow_multiple,
                allow_coerce=allow_coerce,
            )
    except ValueError as e:
        raise TypeError(e)

    return model(**hydration_values)


def _check_types(value, literal, expected):
    if literal:
        if expected is Any:
            return
        elif value != expected:
            raise ValueError(f"Value '{value}' must be {expected}")
    else:
        if not isinstance(value, expected):
            raise ValueError(f"Value '{value}' is not of type {expected}")


def _check_nullability(value, nullable, allowed, schema):
    if not nullable and value is None:
        raise ValueError("Value cannot be None")
    if nullable and value is not None:
        allowed[0].validate(value, schema)


def _check_inclusion(value, allowed, schema, allow_multiple, allow_coerce):
    for option in allowed:
        try:
            return option.validate(value, schema, allow_multiple, allow_coerce)
        except (ValueError, TypeError):
            ...

    options = ", ".join([str(option.hint) for option in allowed])
    raise ValueError(f"Value '{value}' must be one of {options}")


def _check_list(value, allowed, hint, schema, allow_multiple, allow_coerce):
    if isinstance(value, list):
        try:
            return [
                _check_inclusion(
                    item, allowed, schema, allow_multiple, allow_coerce
                )
                for item in value
            ]
        except (ValueError, TypeError):
            ...
    raise ValueError(f"Value '{value}' must be a {hint}")


def _check_dict(value, allowed, hint, schema, allow_multiple, allow_coerce):
    if isinstance(value, dict):
        try:
            return {
                key: _check_inclusion(
                    item, allowed, schema, allow_multiple, allow_coerce
                )
                for key, item in value.items()
            }
        except (ValueError, TypeError):
            ...
    raise ValueError(f"Value '{value}' must be a {hint}")
