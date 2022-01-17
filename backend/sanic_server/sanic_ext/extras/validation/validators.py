from typing import Any, Callable, Dict, Tuple, Type

from sanic_ext.exceptions import ValidationError

from .check import check_data

try:
    from pydantic import ValidationError as PydanticValidationError

    VALIDATION_ERROR: Tuple[Type[Exception], ...] = (
        TypeError,
        PydanticValidationError,
    )
except ImportError:
    VALIDATION_ERROR = (TypeError,)


def validate_body(
    validator: Callable[[Type[Any], Dict[str, Any]], Any],
    model: Type[Any],
    body: Dict[str, Any],
) -> Any:
    try:
        return validator(model, body)
    except VALIDATION_ERROR as e:
        raise ValidationError(
            f"Invalid request body: {model.__name__}. Error: {e}"
        )


def _validate_instance(model, body):
    return model(**body)


def _validate_annotations(model, body, schema, allow_multiple, allow_coerce):
    return check_data(model, body, schema, allow_multiple, allow_coerce)
