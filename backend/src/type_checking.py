from __future__ import annotations

import ast
import inspect
import os
from enum import Enum
from typing import Any, Callable, Dict, List, NewType, Set, Union, cast, get_args

from custom_types import NodeType
from nodes.base_input import BaseInput
from nodes.base_output import BaseOutput

_Ty = NewType("_Ty", object)


class TypeMismatchError(Exception):
    pass


# Enum for type check level
class TypeCheckLevel(Enum):
    NONE = "none"
    WARN = "warn"
    ERROR = "error"


# If it's stupid but it works, it's not stupid
def get_type_check_level() -> TypeCheckLevel:
    type_check_level = os.environ.get("TYPE_CHECK_LEVEL", TypeCheckLevel.NONE.value)
    if type_check_level.lower() == TypeCheckLevel.NONE.value:
        return TypeCheckLevel.NONE
    elif type_check_level.lower() == TypeCheckLevel.WARN.value:
        return TypeCheckLevel.WARN
    elif type_check_level.lower() == TypeCheckLevel.ERROR.value:
        return TypeCheckLevel.ERROR
    else:
        return TypeCheckLevel.NONE


class TypeTransformer(ast.NodeTransformer):
    def visit_BinOp(self, node: ast.BinOp):
        if isinstance(node.op, ast.BitOr):
            return ast.Subscript(
                value=ast.Name(id="Union", ctx=ast.Load()),
                slice=ast.Index(
                    value=ast.Tuple(
                        elts=[
                            self.visit(node.left),
                            self.visit(node.right),
                        ],
                        ctx=ast.Load(),
                    ),
                    ctx=ast.Load(),
                ),
                ctx=ast.Load(),
            )
        return super().visit_BinOp(node)


def compile_type_string(s: str, filename: str = "<string>"):
    tree = ast.parse(s, filename, "eval")
    new_tree = ast.fix_missing_locations(TypeTransformer().visit(tree))
    return compile(new_tree, filename, "eval")


def eval_type(t: str | _Ty, __globals: dict[str, Any]):
    if not isinstance(t, str):
        return t

    # `compile_type_string` adds `Union`, so we need it in scope
    local_scope = {
        "Union": Union,
    }

    try:
        # pylint: disable=eval-used
        return _Ty(eval(compile_type_string(t), __globals, local_scope))
    except Exception as e:
        raise ValueError(f"Unable to evaluate type '{t}': {e}") from e


def union_types(types: List[_Ty]) -> _Ty:
    assert len(types) > 0
    t: Any = types[0]
    for t2 in types[1:]:
        t = Union[t, cast(Any, t2)]
    return t


def union_to_set(t: _Ty) -> Set[_Ty]:
    s = str(t)
    if s.startswith("typing.Union["):
        return set(get_args(t))
    elif s.startswith("typing.Optional["):
        return {*union_to_set(get_args(t)[0]), _Ty(type(None))}
    else:
        return {t}


def is_subset_of(a: _Ty, b: _Ty) -> bool:
    if a == b:
        return True

    return union_to_set(a).issubset(union_to_set(b))


def get_type_annotations(fn: Callable) -> Dict[str, _Ty]:
    """Get the annotations for a function, with support for Python 3.8+"""
    ann = getattr(fn, "__annotations__", None)

    if ann is None:
        return {}

    type_annotations: Dict[str, _Ty] = {}
    for k, v in ann.items():
        type_annotations[k] = eval_type(v, fn.__globals__)
    return type_annotations


def validate_return_type(return_type: _Ty, outputs: list[BaseOutput]):
    if len(outputs) == 0:
        if return_type is not None:  # type: ignore
            raise TypeMismatchError(
                f"Return type should be 'None' because there are no outputs"
            )
    elif len(outputs) == 1:
        o = outputs[0]
        if o.associated_type is not None and not is_subset_of(
            return_type, o.associated_type
        ):
            raise TypeMismatchError(
                f"Return type '{return_type}' must be a subset of '{o.associated_type}'"
            )
    else:
        if not str(return_type).startswith("typing.Tuple["):
            raise TypeMismatchError(
                f"Return type '{return_type}' must be a tuple because there are multiple outputs"
            )

        return_args = get_args(return_type)
        if len(return_args) != len(outputs):
            raise TypeMismatchError(
                f"Return type '{return_type}' must have the same number of arguments as there are outputs"
            )

        for o, return_arg in zip(outputs, return_args):
            if o.associated_type is not None and not is_subset_of(
                return_arg, o.associated_type
            ):
                raise TypeMismatchError(
                    f"Return type of {o.label} '{return_arg}' must be a subset of '{o.associated_type}'"
                )


def typeValidateSchema(
    wrapped_func: Callable,
    node_type: NodeType,
    inputs: list[BaseInput],
    outputs: list[BaseOutput],
):
    """
    Runtime validation for the number of inputs/outputs compared to the type args
    """

    ann = get_type_annotations(wrapped_func)

    # check return type
    if "return" in ann:
        validate_return_type(ann.pop("return"), outputs)

    # check inputs

    arg_spec = inspect.getfullargspec(wrapped_func)
    for arg in arg_spec.args:
        if not arg in ann:
            raise TypeMismatchError(f"Missing type annotation for '{arg}'")

    if node_type == "iteratorHelper":
        # iterator helpers have inputs that do not describe the arguments of the function, so we can't check them
        return

    if node_type == "iterator":
        # the last argument of an iterator is the iterator context, so we have to account for that
        context = [*ann.keys()][-1]
        context_type = ann.pop(context)
        if str(context_type) != "<class 'process.IteratorContext'>":
            raise TypeMismatchError(
                f"Last argument of an iterator must be an IteratorContext, not '{context_type}'"
            )

    if arg_spec.varargs is not None:
        if not arg_spec.varargs in ann:
            raise TypeMismatchError(f"Missing type annotation for '{arg_spec.varargs}'")
        va_type = ann.pop(arg_spec.varargs)

        # split inputs by varargs and non-varargs
        varargs_inputs = inputs[len(ann) :]
        inputs = inputs[: len(ann)]

        total: list[_Ty] | None = []
        for i in varargs_inputs:
            associated_type = i.associated_type

            if associated_type is not None:
                if not is_subset_of(associated_type, va_type):
                    raise TypeMismatchError(
                        f"Input type of {i.label} '{associated_type}' is not assignable to varargs type '{va_type}'"
                    )

            # append to total
            if associated_type is not None:
                if total is not None:
                    total.append(associated_type)
            else:
                total = None

        if total is not None:
            total_type = union_types(total)
            if total_type != va_type:
                raise TypeMismatchError(
                    f"Varargs type '{va_type}' should be equal to the union of all arguments '{total_type}'"
                )

    if len(ann) != len(inputs):
        raise TypeMismatchError(
            f"Number of inputs and arguments don't match: {len(ann)=} != {len(inputs)=}"
        )
    for (a_name, a_type), i in zip(ann.items(), inputs):
        associated_type = i.associated_type
        if associated_type is not None and a_type != associated_type:
            raise TypeMismatchError(
                f"Expected type of {i.label} ({a_name}) to be '{associated_type}' but found '{a_type}'"
            )
