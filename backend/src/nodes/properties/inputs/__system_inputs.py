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
        # TODO: Add support for "auto" and "datetime"
        # The idea here is that we can figure out what value to use here based on this, rather than looking for the node's schema id
        # I kinda don't like this, but i can't see another way to do this
        value_of: Literal["execution_number", "datetime", "auto"] = "auto",
    ):
        super().__init__(navi_type, label, kind="static", has_handle=False)

        self.associated_type = py_type
        self.value_of = value_of

    def to_dict(self):
        return {
            **super().to_dict(),
            "valueOf": self.value_of,
        }

    def enforce(self, value: object):
        return_value = value
        if not isinstance(value, self.associated_type):
            return_value = self.associated_type(value)

        if isinstance(value, (float, int)) and math.isnan(value):
            raise ValueError("NaN is not a valid number")

        return return_value
