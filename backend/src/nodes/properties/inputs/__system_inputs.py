from __future__ import annotations

import math
from typing import Literal

from api import BaseInput
from navi import ExpressionJson


class StaticValueInput(BaseInput):
    def __init__(
        self,
        label: str,
        py_type: type = str,
        navi_type: ExpressionJson = "string",
        value: Literal["execution_number"] = "execution_number",
    ):
        super().__init__(navi_type, label, kind="static", has_handle=False)

        self.associated_type = py_type
        self.value = value

    def to_dict(self):
        return {
            **super().to_dict(),
            "value": self.value,
        }

    def enforce(self, value: object):
        return_value = value
        if not isinstance(value, self.associated_type):
            return_value = self.associated_type(value)

        if isinstance(value, float | int) and math.isnan(value):
            raise ValueError("NaN is not a valid number")

        return return_value
