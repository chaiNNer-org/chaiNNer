from __future__ import annotations

from typing import List, Tuple, Union

from api import BaseInput, NestedGroup, group

from .condition import Condition, EnumValues, InputValue

RawEnumValues = Union[
    InputValue, List[str], List[int], Tuple[str, ...], Tuple[int, ...]
]


def if_group(condition: Condition):
    return group("conditional", {"condition": condition.to_json()})


def if_enum_group(enum: int, condition: EnumValues):
    return if_group(Condition.enum(enum, condition))


def required(condition: Condition | None = None):
    """
    Given generic inputs (meaning of kind "generic") that are optional, this group marks them as
    being required under the given condition. If no condition is given, `True` will be used.

    In addition to the given condition, if the require group is nested within conditional group
    (`if_group` and derivatives), then the conditions of all ancestor conditional groups must also
    be met.

    Note that this group only guarantees **best effort**. It cannot guarantee that the optional
    input is going to have a value if the condition is met. You must always check `None`.

    Example:
    ```py
    if_group(someCondition)(
        required()(
            GenericInput("Foo").make_optional(),
        )
    )
    ```

    In this example, the input "Foo" is required if and only if the input is visible (by virtue of
    the parent conditional group).
    """

    if condition is None:
        condition = Condition.const(True)
    return group("required", {"condition": condition.to_json()})


def seed_group(seed_input: BaseInput):
    """
    This groups is a wrapper around the `SeedInput`. It changes its visual appearance and adds a
    little button for users to click on to generate a new seed.

    All `SeedInput`s must be wrapped in this group.

    Example:
    ```py
    seed_group(SeedInput())
    ```
    """
    return group("seed")(seed_input)


def optional_list_group(*inputs: BaseInput | NestedGroup):
    """
    This groups wraps around optional inputs and displays them as a list.

    This can be used to create nodes that have a variable number of inputs. The user will initially
    see no inputs, but can add as many inputs as the group contains. While not true varargs, this
    can be used to create a similar effect.

    See the Text Append node for an example.
    """
    return group("optional-list")(*inputs)


def linked_inputs_group(*inputs: BaseInput):
    """
    This group wraps around inputs of the same type. It ensures that all inputs have the same
    value.

    "The same type" here not only refers to the Navi type of those inputs. All possible values
    from all inputs must also be valid values for all other inputs. This typically necessitates
    that the inputs are of the same class and use the same parameters.
    """
    return group("linked-inputs")(*inputs)


def ncnn_file_inputs_group(param_input: BaseInput, bin_input: BaseInput):
    """
    This group wraps around 2 .param and .bin file inputs and synchronizes them in the UI.
    """
    return group("ncnn-file-inputs")(param_input, bin_input)


def from_to_dropdowns_group(from_dd: BaseInput, to_dd: BaseInput):
    """
    This group wraps around 2 dropdown inputs that will be displayed as
    `[From] -> [To]` in the UI.
    """
    return group("from-to-dropdowns")(from_dd, to_dd)


def icon_set_group(label: str):
    """
    This group causes the given boolean inputs to be displayed as a set of icons instead of
    checkboxes. The icons are specified by the `icons` parameter.
    """
    return group("icon-set", {"label": label})
