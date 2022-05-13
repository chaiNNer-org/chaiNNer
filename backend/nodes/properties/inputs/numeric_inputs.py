from .base_input import BaseInput


def clampInt(value, min_value, max_value):
    value = int(value)
    if max_value is not None:
        value = min(value, max_value)
    if min_value is not None:
        value = max(value, min_value)
    return value


def clampFloat(value, min_value, max_value):
    value = float(value)
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
        default=0.0,
        minimum=0,
        maximum=None,
        step=1,
        optional=False,
        number_type="any",
        minimum_label: str = None,
        maximum_label: str = None,
    ):
        super().__init__(f"number::{number_type}", label)
        self.default = default
        self.minimum = minimum
        self.maximum = maximum
        self.step = step
        self.optional = optional
        self.minimum_label = minimum_label
        self.maximum_label = maximum_label

    def toDict(self):
        return {
            "type": self.input_type,
            "label": self.label,
            "min": self.minimum,
            "max": self.maximum,
            "minLabel": self.minimum_label,
            "maxLabel": self.maximum_label,
            "def": self.default,
            "step": self.step,
            "hasHandle": True,
            "optional": self.optional,
        }

    def enforce(self, value):
        return clampFloat(value, self.minimum, self.maximum)


class IntegerInput(NumberInput):
    """Input an integer number"""

    def __init__(self, label: str):
        super().__init__(label, default=0, minimum=0, maximum=None, step=None)

    def enforce(self, value):
        return clampInt(value, self.minimum, self.maximum)


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
        return clampFloat(value, self.minimum, self.maximum)


class OddIntegerInput(NumberInput):
    """Input for an odd integer number"""

    def __init__(self, label: str, default: int = 1, minimum: int = 1):
        super().__init__(label, default=default, minimum=minimum, maximum=None, step=2)

    def enforce(self, value):
        odd = int(value) + (1 - (int(value) % 2))
        return clampInt(odd, self.minimum, self.maximum)


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
        return clampInt(value, self.minimum, self.maximum)


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
        min_label: str = None,
        max_label: str = None,
    ):
        super().__init__(
            label,
            default=default,
            minimum=min_val,
            maximum=max_val,
            minimum_label=min_label,
            maximum_label=max_label,
            step=1,
            optional=optional,
            number_type="slider",
        )

    def enforce(self, value):
        return clampInt(value, self.minimum, self.maximum)
