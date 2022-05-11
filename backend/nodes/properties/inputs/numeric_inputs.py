from math import inf

from .base_input import BaseInput


class NumberInput(BaseInput):
    """Input a number"""

    def __init__(
        self,
        label: str,
        default=0.0,
        minimum=0,
        maximum=inf,
        step=1,
        optional=False,
        number_type="any",
    ):
        super().__init__(f"number::{number_type}", label)
        self.default = default
        self.minimum = minimum if minimum is not None else inf
        self.maximum = maximum if maximum is not None else -inf
        self.step = step
        self.optional = optional

    def toDict(self):
        return {
            "type": self.input_type,
            "label": self.label,
            "min": self.minimum,
            "max": self.maximum,
            "def": self.default,
            "step": self.step,
            "hasHandle": True,
            "optional": self.optional,
        }

    def enforce(self, value):
        return min(max(float(self.minimum), float(value)), float(self.maximum))


class IntegerInput(NumberInput):
    """Input an integer number"""

    def __init__(self, label: str):
        super().__init__(label, default=0, minimum=0, maximum=None, step=None)

    def enforce(self, value):
        return max(int(self.minimum), int(value))


class BoundedNumberInput(NumberInput):
    """Input for a bounded float number range"""

    def __init__(
        self,
        label: str,
        minimum: float = 0.0,
        maximum: float = 1.0,
        default: float = 0.5,
        step: float = 0.25,
    ):
        super().__init__(
            label, default=default, minimum=minimum, maximum=maximum, step=step
        )

    def enforce(self, value):
        return min(max(float(self.minimum), float(value)), float(self.maximum))


class OddIntegerInput(NumberInput):
    """Input for an odd integer number"""

    def __init__(self, label: str, default: int = 1, minimum: int = 1):
        super().__init__(label, default=default, minimum=minimum, maximum=None, step=2)

    def enforce(self, value):
        odd = int(value) - (1 - (int(value) % 2))
        capped = max(int(self.minimum), odd)
        return capped


class BoundedIntegerInput(NumberInput):
    """Input for a bounded integer number range"""

    def __init__(
        self,
        label: str,
        minimum: int = 0,
        maximum: int = 100,
        default: int = 50,
        optional: bool = False,
    ):
        super().__init__(
            label,
            default=default,
            minimum=minimum,
            maximum=maximum,
            optional=optional,
        )

    def enforce(self, value):
        return min(max(int(self.minimum), int(value)), int(self.maximum))


class BoundlessIntegerInput(NumberInput):
    """Input for a boundless integer number"""

    def __init__(
        self,
        label: str,
    ):
        super().__init__(
            label,
            default=0,
            minimum=None,
            maximum=None,
        )

    def enforce(self, value):
        return int(value)


class SliderInput(NumberInput):
    """Input for integer number via slider"""

    def __init__(
        self,
        label: str,
        min_val: int = 0,
        max_val: int = 100,
        default: int = 50,
        optional: bool = False,
    ):
        super().__init__(
            label,
            default=default,
            minimum=min_val,
            maximum=max_val,
            step=1,
            optional=optional,
            number_type="slider",
        )

    def enforce(self, value):
        return min(max(int(self.minimum), int(value)), int(self.maximum))
