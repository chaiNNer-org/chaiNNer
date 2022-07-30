from typing import Union, Tuple

from .base_input import BaseInput, InputKind
from .. import expression


def clampNumber(
    value: Union[float, int],
    precision: Union[int, None],
    min_value: Union[float, int, None],
    max_value: Union[float, int, None],
) -> Union[float, int]:
    # Convert proper number type
    value = round(value, precision)

    # Clamp to max and min, correcting for max/min not aligning with offset + n * step
    if max_value is not None:
        value = min(value, max_value)
    if min_value is not None:
        value = max(value, min_value)

    return value


def get_number_type(
    min: Union[float, int, None],
    max: Union[float, int, None],
    precision: Union[int, None],
) -> expression.ExpressionJson:
    if precision is not None and precision > 0:
        # step is not an integer
        return expression.interval(min, max)
    return expression.int_interval(min, max)


class NumberInput(BaseInput):
    """Input a number"""

    def __init__(
        self,
        label: str,
        precision: Union[int, None] = None,
        controls_step: Union[float, int, None] = None,
        default: Union[float, int] = 0,
        minimum: Union[float, int, None] = 0,
        maximum: Union[float, int, None] = None,
        unit: Union[str, None] = None,
        note_expression: Union[str, None] = None,
        kind: InputKind = "number",
        hide_trailing_zeros: bool = True,
    ):
        super().__init__("number", label, kind=kind, has_handle=True)
        self.precision = precision
        # controls_step is for increment/decrement arrows.
        self.controls_step = (
            controls_step if controls_step is not None else 10 ** -(precision or 0)
        )
        self.default = default
        self.minimum = minimum
        self.maximum = maximum
        self.unit = unit
        self.note_expression = note_expression
        self.hide_trailing_zeros = hide_trailing_zeros

        self.input_type = get_number_type(
            self.minimum,
            self.maximum,
            self.precision,
        )
        if self.precision == 0:
            self.input_conversion = """
                match Input {
                    number as i => round(i),
                    _ as i => i,
                }
            """

    def toDict(self):
        return {
            **super().toDict(),
            "min": self.minimum,
            "max": self.maximum,
            "noteExpression": self.note_expression,
            "def": self.default,
            "precision": self.precision,
            "controlsStep": self.controls_step,
            "unit": self.unit,
            "hideTrailingZeros": self.hide_trailing_zeros,
        }

    def make_optional(self):
        raise ValueError("NumberInput and SliderInput cannot be made optional")

    def enforce(self, value):
        return clampNumber(value, self.precision, self.minimum, self.maximum)


class SliderInput(NumberInput):
    """Input for integer number via slider"""

    def __init__(
        self,
        label: str,
        precision: int = 0,
        controls_step: Union[float, int, None] = None,
        slider_step: Union[float, int, None] = None,
        minimum: Union[float, int] = 0,
        maximum: Union[float, int] = 100,
        default: Union[float, int] = 50,
        unit: Union[str, None] = None,
        note_expression: Union[str, None] = None,
        ends: Tuple[Union[str, None], Union[str, None]] = (None, None),
        hide_trailing_zeros: bool = False,
    ):
        super().__init__(
            label,
            precision=precision,
            controls_step=controls_step,
            default=default,
            minimum=minimum,
            maximum=maximum,
            unit=unit,
            note_expression=note_expression,
            kind="slider",
            hide_trailing_zeros=hide_trailing_zeros,
        )
        self.ends = ends
        self.slider_step = (
            slider_step
            if slider_step is not None
            else (controls_step if controls_step is not None else 10**-precision)
        )

    def toDict(self):
        return {
            **super().toDict(),
            "ends": self.ends,
            "sliderStep": self.slider_step,
        }
