from typing import Union, Tuple

from .base_input import BaseInput


def clampNumber(
    value: Union[float, int],
    offset: Union[float, int],
    step: Union[float, int],
    min_value: Union[float, int, None],
    max_value: Union[float, int, None],
) -> Union[float, int]:
    # Convert proper number type
    if offset % 1 == 0 and step % 1 == 0:
        value = int(value)
    else:
        value = float(value)

    # Ensure value adheres to step and offset
    value = round((value - offset) / step) * step + offset

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
        step: Union[float, int] = 1,
        controls_step: Union[float, int, None] = None,
        default: Union[float, int] = 0,
        minimum: Union[float, int, None] = 0,
        maximum: Union[float, int, None] = None,
        unit: Union[str, None] = None,
        number_type: str = "any",
        note_expression: Union[str, None] = None,
        hide_trailing_zeros: bool = True,
    ):
        super().__init__(f"number::{number_type}", label, has_handle=True)
        # Step is for the actual increment.
        # controls_step is for increment/decrement arrows.
        self.step = step
        self.controls_step = step if controls_step is None else controls_step
        self.offset = minimum % step if minimum is not None else 0
        self.default = default
        self.minimum = minimum
        self.maximum = maximum
        self.unit = unit
        self.note_expression = note_expression
        self.hide_trailing_zeros = hide_trailing_zeros

    def toDict(self):
        return {
            **super().toDict(),
            "min": self.minimum,
            "max": self.maximum,
            "noteExpression": self.note_expression,
            "def": self.default,
            "offset": self.offset,
            "step": self.step,
            "controlsStep": self.controls_step,
            "unit": self.unit,
            "hideTrailingZeros": self.hide_trailing_zeros,
        }

    def make_optional(self):
        raise ValueError("DropDownInput cannot be made optional")

    def enforce(self, value):
        return clampNumber(value, self.offset, self.step, self.minimum, self.maximum)


class SliderInput(NumberInput):
    """Input for integer number via slider"""

    def __init__(
        self,
        label: str,
        step: Union[float, int] = 1,
        controls_step: Union[float, int, None] = None,
        slider_step: Union[float, int, None] = None,
        minimum: int = 0,
        maximum: int = 100,
        default: int = 50,
        unit: Union[str, None] = None,
        note_expression: Union[str, None] = None,
        ends: Tuple[Union[str, None], Union[str, None]] = (None, None),
        hide_trailing_zeros: bool = False,
    ):
        super().__init__(
            label,
            step=step,
            controls_step=controls_step,
            default=default,
            minimum=minimum,
            maximum=maximum,
            unit=unit,
            note_expression=note_expression,
            number_type="slider",
            hide_trailing_zeros=hide_trailing_zeros,
        )
        self.ends = ends
        self.slider_step = (
            slider_step
            if slider_step is not None
            else (controls_step if controls_step is not None else step)
        )

    def toDict(self):
        return {
            **super().toDict(),
            "ends": self.ends,
            "sliderStep": self.slider_step,
        }

    def enforce(self, value):
        return clampNumber(value, self.offset, self.step, self.minimum, self.maximum)
