import datetime
from typing import Dict, Generic, List, Literal, Tuple, Type, TypedDict, TypeVar, Union

from .generic_inputs import TextInput


class DateTimeFormatInput(TextInput):
    """Input for formatting datetime"""

    def __init__(
        self,
        label: str = "Datetime Format",
        has_handle=False,
        placeholder: Union[str, None] = "%f",
        default: Union[str, None] = None,
        min_length: int = 1,
        max_length: Union[int, None] = None,
        allow_numbers: bool = True,
    ):
        super().__init__(
            label,
            placeholder=placeholder,
            default=default,
            has_handle=has_handle,
            min_length=min_length,
            max_length=max_length,
            allow_numbers=False,
        )
        self.associated_type = str

    def enforce(self, value) -> str:
        isValid = False
        try:
            now = datetime.datetime.now()
            result = now.strftime(value)
            isValid = True
        except:
            isValid = False
        assert isValid == True, "Format is invalid"
        return str(value)

    def toDict(self):
        return {
            **super().toDict(),
            "placeholder": self.placeholder,
            "def": self.default,
        }
