from functools import partial
from inspect import isawaitable, isclass

from sanic.log import logger

from sanic_ext.exceptions import ValidationError

from .schema import make_schema
from .validators import (
    _validate_annotations,
    _validate_instance,
    validate_body,
)

try:
    from pydantic import BaseModel

    PYDANTIC = True
except ImportError:
    PYDANTIC = False


async def do_validation(
    *,
    model,
    data,
    schema,
    request,
    kwargs,
    body_argument,
    allow_multiple,
    allow_coerce,
):
    try:
        logger.debug(f"Validating {request.path} using {model}")
        if model is not None:
            if isclass(model):
                validator = _get_validator(
                    model, schema, allow_multiple, allow_coerce
                )
                validation = validate_body(validator, model, data)
                kwargs[body_argument] = validation
            else:
                validation = model(
                    request=request, data=data, handler_kwargs=kwargs
                )
                if isawaitable(validation):
                    await validation
    except TypeError as e:
        raise ValidationError(e)


def generate_schema(param):
    try:
        if param is None or _is_pydantic(param):
            return param
    except TypeError:
        ...

    return make_schema({}, param) if isclass(param) else param


def _is_pydantic(model):
    is_pydantic = PYDANTIC and (
        issubclass(model, BaseModel) or hasattr(model, "__pydantic_model__")
    )
    return is_pydantic


def _get_validator(model, schema, allow_multiple, allow_coerce):
    if _is_pydantic(model):
        return _validate_instance

    return partial(
        _validate_annotations,
        schema=schema,
        allow_multiple=allow_multiple,
        allow_coerce=allow_coerce,
    )
