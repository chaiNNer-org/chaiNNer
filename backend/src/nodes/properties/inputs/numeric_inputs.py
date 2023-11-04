from __future__ import annotations

import math
from typing import Literal

import navi
from api import BaseInput, InputConversion, InputKind

from ...utils.utils import round_half_up


def clamp_number(
    value: float | int,
    precision: int,
    min_value: float | int | None,
    max_value: float | int | None,
) -> float | int:
    # Convert proper number type
    value = round_half_up(value) if precision == 0 else round(value, precision)

    # Clamp to max and min, correcting for max/min not aligning with offset + n * step
    if max_value is not None:
        value = min(value, max_value)
    if min_value is not None:
        value = max(value, min_value)

    # guarantee integers
    if precision <= 0:
        return int(value)
    else:
        return float(value)


def get_number_type(
    min_value: float | int | None,
    max_value: float | int | None,
    precision: int,
) -> navi.ExpressionJson:
    if precision > 0:
        # step is not an integer
        return navi.interval(min_value, max_value)
    return navi.int_interval(min_value, max_value)


class NumberInput(BaseInput):
    """Input a number"""

    def __init__(
        self,
        label: str,
        precision: int = 0,
        controls_step: float | int | None = None,
        default: float | int = 0,
        minimum: float | int | None = 0,
        maximum: float | int | None = None,
        unit: str | None = None,
        note_expression: str | None = None,
        kind: InputKind = "number",
        hide_trailing_zeros: bool = True,
        hide_label: bool = False,
        has_handle: bool = True,
    ):
        super().__init__("number", label, kind=kind, has_handle=has_handle)
        self.precision = precision
        # controls_step is for increment/decrement arrows.
        self.controls_step: float | int = (
            controls_step if controls_step is not None else 10**-precision
        )
        self.default = default
        self.minimum = minimum
        self.maximum = maximum
        self.unit = unit
        self.note_expression = note_expression
        self.hide_trailing_zeros = hide_trailing_zeros
        self.hide_label = hide_label

        self.associated_type = float if precision > 0 else int

        self.input_type = get_number_type(
            self.minimum,
            self.maximum,
            self.precision,
        )
        if self.precision == 0:
            self.input_conversions = [InputConversion("number", "round(Input)")]

    def to_dict(self):
        return {
            **super().to_dict(),
            "min": self.minimum,
            "max": self.maximum,
            "noteExpression": self.note_expression,
            "def": self.default,
            "precision": self.precision,
            "controlsStep": self.controls_step,
            "unit": self.unit,
            "hideTrailingZeros": self.hide_trailing_zeros,
            "hideLabel": self.hide_label,
            "hasHandle": self.has_handle,
        }

    def make_optional(self):
        raise ValueError("NumberInput and SliderInput cannot be made optional")

    def enforce(self, value):
        assert isinstance(value, (int, float))

        if math.isnan(value):
            raise ValueError("NaN is not a valid number")

        return clamp_number(value, self.precision, self.minimum, self.maximum)


class SliderInput(NumberInput):
    """Input for integer number via slider"""

    def __init__(
        self,
        label: str,
        precision: int = 0,
        controls_step: float | int | None = None,
        slider_step: float | int | None = None,
        minimum: float | int = 0,
        maximum: float | int = 100,
        default: float | int = 50,
        unit: str | None = None,
        note_expression: str | None = None,
        ends: tuple[str | None, str | None] = (None, None),
        hide_trailing_zeros: bool = False,
        gradient: list[str] | None = None,
        scale: Literal["linear", "log", "log-offset", "sqrt"] = "linear",
        has_handle: bool = True,
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
            has_handle=has_handle,
        )
        self.ends = ends
        self.slider_step = (
            slider_step
            if slider_step is not None
            else (controls_step if controls_step is not None else 10**-precision)
        )
        self.gradient = gradient
        self.scale = scale

    def to_dict(self):
        return {
            **super().to_dict(),
            "ends": self.ends,
            "sliderStep": self.slider_step,
            "gradient": self.gradient,
            "scale": self.scale,
        }
