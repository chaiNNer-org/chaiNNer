from typing import Union, Tuple

from numpy import isin

from .base_input import BaseInput


def clampNumber(
    value: Union[float, int],
    precision: int,
    offset: Union[float, int],
    step: Union[float, int],
    min_value: Union[float, int],
    max_value: Union[float, int],
) -> Union[float, int]:
    # Convert proper number type
    if precision:
        value = float(value)
    else:
        value = int(value)

    # Ensure value adheres to step and offset
    value = (
        round((round((value - offset) / step) * step + offset) * 10**precision)
        * 10**-precision
    )

    # Clamp to max and min, correcting for max/min not aligning with offset + n * step
    if max_value is not None:
        value = min(value, max_value)
    if min_value is not None:
        value = max(value, min_value)

    return value


class NumberInput(BaseInput):
    """Input a number"""

    def __init__(
        self,
        label: str,
        precision: int = 0,
        offset: Union[float, int] = 0,
        step: Union[float, int] = 1,
        controlsStep: Union[float, int] = None,
        default: Union[float, int] = 0,
        minimum: Union[float, int] = None,
        maximum: Union[float, int] = None,
        units: str = None,
        has_handle: bool = True,
        optional: bool = False,
        number_type: str = "any",
        note_expression: str = None,
    ):
        super().__init__(f"number::{number_type}", label)
        # TODO: It might make sense to do some validation like making sure step matches precision, etc.
        self.precision = precision
        self.offset = offset
        # Step is for the actual increment and should match precision.
        # controlsStep is for increment/decrement arrows.
        self.step = step
        self.controlsStep = step if controlsStep is None else controlsStep
        self.default = default
        self.minimum = minimum
        self.maximum = maximum
        self.units = units
        self.has_handle = has_handle
        self.optional = optional
        self.note_expression = note_expression

    def toDict(self):
        return {
            "type": self.input_type,
            "label": self.label,
            "min": self.minimum,
            "max": self.maximum,
            "noteExpression": self.note_expression,
            "def": self.default,
            "precision": self.precision,
            "offset": self.offset,
            "step": self.step,
            "controlsStep": self.controlsStep,
            "units": self.units,
            "hasHandle": self.has_handle,
            "optional": self.optional,
        }

    def enforce(self, value):
        return clampNumber(
            value, self.precision, self.offset, self.step, self.minimum, self.maximum
        )


class SliderInput(NumberInput):
    """Input for integer number via slider"""

    def __init__(
        self,
        label: str,
        precision: int = 0,
        offset: Union[float, int] = 0,
        step: Union[float, int] = 1,
        controlsStep: Union[float, int] = None,
        minimum: int = 0,
        maximum: int = 100,
        default: int = 50,
        units: str = None,
        has_handle: bool = True,
        optional: bool = False,
        note_expression: str = None,
        ends: Union[Tuple[int, int], Tuple[str, str]] = (None, None),
    ):
        super().__init__(
            label,
            precision=precision,
            offset=offset,
            step=step,
            controlsStep=controlsStep,
            default=default,
            minimum=minimum,
            maximum=maximum,
            units=units,
            optional=optional,
            has_handle=has_handle,
            note_expression=note_expression,
            number_type="slider",
        )
        self.ends = (minimum, maximum) if ends == (None, None) else ends

    def toDict(self):
        return {
            "type": self.input_type,
            "label": self.label,
            "min": self.minimum,
            "max": self.maximum,
            "noteExpression": self.note_expression,
            "ends": self.ends,
            "def": self.default,
            "precision": self.precision,
            "offset": self.offset,
            "step": self.step,
            "controlsStep": self.controlsStep,
            "units": self.units,
            "hasHandle": True,
            "optional": self.optional,
        }

    def enforce(self, value):
        return clampNumber(
            value, self.precision, self.offset, self.step, self.minimum, self.maximum
        )
