from __future__ import annotations

import ast
from typing import Any, Callable, Type, Union, get_args

import numpy as np

from custom_types import NodeType, RunFn
from nodes.properties.inputs.base_input import BaseInput
from nodes.properties.outputs.base_output import BaseOutput

RunFn = Callable[..., Any]


class TypeTransformer(ast.NodeTransformer):
    def visit_BinOp(self, node: ast.BinOp):
        if isinstance(node.op, ast.BitOr):
            return ast.Subscript(
                value=ast.Name(id="Union", ctx=ast.Load()),
                slice=ast.Tuple(
                    elts=[
                        self.visit(node.left),
                        self.visit(node.right),
                    ],
                    ctx=ast.Load(),
                ),
                ctx=ast.Load(),
            )
        return super().visit_BinOp(node)


def compile_type_string(s: str, filename: str = "<string>"):
    tree = ast.parse(s, filename, "eval")
    new_tree = ast.fix_missing_locations(TypeTransformer().visit(tree))
    return compile(new_tree, filename, "eval")


def validateTypes(
    wrapped_func: RunFn,
    schema_id: str,
    py_var: str,
    py_type: Union[str, Any],
    associated_type: Type,
):
    evaluated_py_type = py_type
    if isinstance(py_type, str):
        try:
            # Allows us to use pipe unions still
            if "|" in py_type:
                py_type = compile_type_string(py_type)
            # Gotta add these to the scope
            local_scope = {
                "Union": Union,
                "np": np,
            }
            # pylint: disable=eval-used
            evaluated_py_type = eval(
                py_type,
                wrapped_func.__globals__,
                local_scope,
            )
        except Exception as e:
            raise ValueError(
                f"Unable to evaluate type for {schema_id}: {py_type=} | {e}"
            ) from e
    if evaluated_py_type is not associated_type:
        types_with_args = [
            "typing.Optional",
            "typing.Union",
            "typing.Tuple",
            "typing.List",
        ]

        def get_type_args(tp):
            if any(str(tp).startswith(t) for t in types_with_args):
                return get_args(tp)
            else:
                return None

        evaluated_py_type_args = get_type_args(evaluated_py_type) or [evaluated_py_type]
        associated_type_args = get_type_args(associated_type) or [associated_type]

        if (
            evaluated_py_type in associated_type_args
            or associated_type in evaluated_py_type_args
        ):
            # The types are compatible
            pass
        elif any(t in associated_type_args for t in evaluated_py_type_args):
            # The types are compatible
            pass
        else:
            raise ValueError(
                f"Type mismatch for {schema_id} (i='{py_var}'): {evaluated_py_type=} != {associated_type=}"
            )


def typeValidateSchema(
    wrapped_func: RunFn,
    node_type: NodeType,
    schema_id: str,
    p_inputs: list[BaseInput],
    p_outputs: list[BaseOutput],
):
    """Runtime validation for the number of inputs/outputs compared to the type args
    While this isn't a comprehensive check, it's a good start for ensuring parity between the schema and the types
    """

    # We can't use inspect.get_annotations() since we need to support 3.8+
    ann = getattr(wrapped_func, "__annotations__", None)

    if ann is None:
        return

    ann = ann.copy()

    # We don't want to run this check on iterator helpers as they can have different input/output metadata than what they actually run
    if node_type == "iteratorHelper":
        return

    ### Return type validation

    # Pop the return type key off the dict
    return_type = ann.pop("return", None)
    if return_type is not None:
        return_type_str = str(return_type)
        # Evaluate the return type
        # pylint: disable=eval-used
        if return_type_str.startswith("Tuple"):
            evaluated_return_type = eval(return_type_str, wrapped_func.__globals__)
            output_len = len(get_args(evaluated_return_type))
            for py_type, output_class in zip(
                get_args(evaluated_return_type), p_outputs
            ):
                py_var = output_class.label
                associated_type = output_class.associated_type
                if associated_type is not None:
                    validateTypes(
                        wrapped_func, schema_id, py_var, py_type, associated_type
                    )
        elif return_type_str == "None":
            output_len = 0
        else:
            output_len = 1
            associated_type = p_outputs[0].associated_type
            py_type = return_type
            py_var = "return"
            if associated_type is not None:
                validateTypes(wrapped_func, schema_id, py_var, py_type, associated_type)
        if output_len != len(p_outputs):
            raise ValueError(
                f"Number of outputs and return types don't match for {schema_id}"
            )

    ### Input type validation

    input_len = len(ann.keys())
    # Iterators pass in their context, so we need to account for that
    if node_type == "iterator":
        input_len -= 1
    # Variable args don't have good typing, so right now we just hardcode what to ignore.
    if list(ann.keys())[-1] not in [
        "args",
        "sources",
    ] and input_len != len(p_inputs):
        raise ValueError(
            f"Number of inputs and annotations don't match for {schema_id}: {input_len=} != {len(p_inputs)=}"
        )
    for (py_var, py_type), input_class in zip(ann.items(), p_inputs):
        associated_type = input_class.associated_type
        if associated_type is not None:
            validateTypes(wrapped_func, schema_id, py_var, py_type, associated_type)
