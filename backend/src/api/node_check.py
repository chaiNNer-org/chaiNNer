from __future__ import annotations

import ast
import inspect
import os
import pathlib
from collections import OrderedDict
from enum import Enum
from typing import Any, Callable, NewType, Tuple, Union, cast, get_args

from .node_context import NodeContext
from .node_data import NodeData

_Ty = NewType("_Ty", object)


class CheckFailedError(Exception):
    pass


class CheckLevel(Enum):
    NONE = "none"
    WARN = "warn"
    FIX = "fix"
    ERROR = "error"

    @staticmethod
    def parse(s: str) -> CheckLevel:
        s = s.strip().lower()
        if s == CheckLevel.NONE.value:
            return CheckLevel.NONE
        elif s == CheckLevel.WARN.value:
            return CheckLevel.WARN
        elif s == CheckLevel.FIX.value:
            return CheckLevel.FIX
        elif s == CheckLevel.ERROR.value:
            return CheckLevel.ERROR
        else:
            raise ValueError(f"Invalid check level: {s}")


def _get_check_level(name: str, default: CheckLevel) -> CheckLevel:
    try:
        s = os.environ.get(name, default.value)
        return CheckLevel.parse(s)
    except Exception:
        return default


CHECK_LEVEL = _get_check_level("CHECK_LEVEL", CheckLevel.NONE)
NAME_CHECK_LEVEL = _get_check_level("NAME_CHECK_LEVEL", CHECK_LEVEL)
TYPE_CHECK_LEVEL = _get_check_level("TYPE_CHECK_LEVEL", CHECK_LEVEL)


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

    def visit_Subscript(self, node: ast.Subscript):
        if isinstance(node.value, ast.Name) and node.value.id == "tuple":
            return ast.Subscript(
                value=ast.Name(id="Tuple", ctx=ast.Load()),
                slice=node.slice,
                ctx=ast.Load(),
            )
        return super().visit_Subscript(node)


def compile_type_string(s: str, filename: str = "<string>"):
    tree = ast.parse(s, filename, "eval")
    new_tree = ast.fix_missing_locations(TypeTransformer().visit(tree))
    return compile(new_tree, filename, "eval")


def eval_type(t: str | _Ty, __globals: dict[str, Any], /):
    if not isinstance(t, str):
        return t

    # `compile_type_string` adds `Union`, so we need it in scope
    local_scope = {
        "Union": Union,
        "Tuple": Tuple,
    }

    try:
        # pylint: disable=eval-used
        return _Ty(eval(compile_type_string(t), __globals, local_scope))
    except Exception as e:
        raise ValueError(f"Unable to evaluate type '{t}': {e}") from e


def union_types(types: list[_Ty]) -> _Ty:
    assert len(types) > 0
    t: Any = types[0]
    for t2 in types[1:]:
        t = Union[t, cast(Any, t2)]
    return t


def union_to_set(t: _Ty) -> set[_Ty]:
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


def is_tuple(t: _Ty) -> bool:
    s = str(t)
    return s.startswith(("typing.Tuple[", "tuple["))


class FailedToParse:
    pass


def get_type_annotations(fn: Callable) -> dict[str, _Ty | FailedToParse]:
    """Get the annotations for a function, with support for Python 3.8+"""
    ann = getattr(fn, "__annotations__", None)

    if ann is None:
        return {}

    type_annotations: dict[str, _Ty | FailedToParse] = {}
    for k, v in ann.items():
        try:
            type_annotations[k] = eval_type(v, fn.__globals__)
        except Exception:
            type_annotations[k] = FailedToParse()
    return type_annotations


def validate_return_type(return_type: _Ty, node: NodeData):
    outputs = node.outputs

    if len(outputs) == 0:
        if return_type is not None and return_type is not type(None):  # type: ignore
            raise CheckFailedError(
                "Return type should be 'None' because there are no outputs"
            )
    elif len(outputs) == 1:
        o = outputs[0]
        if o.associated_type is not None and not is_subset_of(
            return_type, o.associated_type
        ):
            raise CheckFailedError(
                f"Return type '{return_type}' must be a subset of '{o.associated_type}'"
            )
    else:
        if not is_tuple(return_type):
            raise CheckFailedError(
                f"Return type '{return_type}' must be a tuple because there are multiple outputs"
            )

        return_args = get_args(return_type)
        if len(return_args) != len(outputs):
            raise CheckFailedError(
                f"Return type '{return_type}' must have the same number of arguments as there are outputs"
            )

        for o, return_arg in zip(outputs, return_args):
            if o.associated_type is not None and not is_subset_of(
                return_arg, o.associated_type
            ):
                raise CheckFailedError(
                    f"Return type of {o.label} '{return_arg}' must be a subset of '{o.associated_type}'"
                )


def check_schema_types(
    wrapped_func: Callable,
    node: NodeData,
):
    """
    Runtime validation for the number of inputs/outputs compared to the type args
    """

    if node.kind != "regularNode":
        return

    ann = OrderedDict(get_type_annotations(wrapped_func))

    # check return type
    if "return" in ann:
        return_type = ann.pop("return")
        if not isinstance(return_type, FailedToParse):
            validate_return_type(return_type, node)

    # check arguments
    arg_spec = inspect.getfullargspec(wrapped_func)
    for arg in arg_spec.args:
        if arg not in ann:
            raise CheckFailedError(f"Missing type annotation for '{arg}'")

    if node.node_context:
        first = arg_spec.args[0]
        if first != "context":
            raise CheckFailedError(
                f"Expected the first parameter to be 'context: NodeContext' but found '{first}'."
            )
        context_type = ann.pop(first)
        if context_type != NodeContext:  # type: ignore
            raise CheckFailedError(
                f"Expected type of 'context' to be 'api.NodeContext' but found '{context_type}'"
            )

    # check inputs
    inputs = node.inputs

    if arg_spec.varargs is not None:
        if arg_spec.varargs not in ann:
            raise CheckFailedError(f"Missing type annotation for '{arg_spec.varargs}'")
        va_type = ann.pop(arg_spec.varargs)

        # split inputs by varargs and non-varargs
        varargs_inputs = inputs[len(ann) :]
        inputs = inputs[: len(ann)]

        total: list[_Ty] | None = []
        for i in varargs_inputs:
            associated_type = i.associated_type

            if associated_type is not None and not isinstance(va_type, FailedToParse):
                if not is_subset_of(associated_type, va_type):
                    raise CheckFailedError(
                        f"Input type of {i.label} '{associated_type}' is not assignable to varargs type '{va_type}'"
                    )

            # append to total
            if associated_type is not None:
                if total is not None:
                    total.append(associated_type)
            else:
                total = None

        if total is not None and not isinstance(va_type, FailedToParse):
            total_type = union_types(total)
            if total_type != va_type:
                raise CheckFailedError(
                    f"Varargs type '{va_type}' should be equal to the union of all arguments '{total_type}'"
                )

    if len(ann) != len(inputs):
        raise CheckFailedError(
            f"Number of inputs and arguments don't match: {len(ann)=} != {len(inputs)=}"
        )
    for (a_name, a_type), i in zip(ann.items(), inputs):
        associated_type = i.associated_type
        if (
            associated_type is not None
            and not isinstance(a_type, FailedToParse)
            and a_type != associated_type
        ):
            raise CheckFailedError(
                f"Expected type of {i.label} ({a_name}) to be '{associated_type}' but found '{a_type}'"
            )


def check_naming_conventions(
    wrapped_func: Callable,
    name: str,
    fix: bool,
):
    expected_name = (
        name.lower()
        .replace(" ", "_")
        .replace("-", "_")
        .replace("(", "")
        .replace(")", "")
        .replace("&", "and")
    )

    func_name = wrapped_func.__name__
    file_path = pathlib.Path(inspect.getfile(wrapped_func))
    file_name = file_path.stem

    # check function name
    if func_name != expected_name + "_node":
        if not fix:
            raise CheckFailedError(
                f"Function name is '{func_name}', but it should be '{expected_name}_node'"
            )

        fixed_code = file_path.read_text(encoding="utf-8").replace(
            f"def {func_name}(", f"def {expected_name}_node("
        )
        file_path.write_text(fixed_code, encoding="utf-8")

    # check file name
    if file_name != expected_name:
        if not fix:
            raise CheckFailedError(
                f"File name is '{file_name}.py', but it should be '{expected_name}.py'"
            )

        os.rename(file_path, file_path.with_name(expected_name + ".py"))
