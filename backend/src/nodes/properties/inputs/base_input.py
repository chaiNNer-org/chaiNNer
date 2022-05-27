from typing import Union


class BaseInput:
    def __init__(self, input_type: str, label: str, has_handle=True):
        self.input_type = input_type
        self.label = label
        self.optional: bool = False
        self.has_handle = has_handle
        self.id: Union[int, None] = None

    # This is the method that should be created by each input
    def enforce(self, value):
        """Enforce the input type"""
        return value

    # This is the method that should be called by the processing code
    def enforce_(self, value):
        if self.optional and value is None:
            return None
        assert (
            value is not None
        ), f"Expected value to exist, but does not exist for type {self.input_type} with label {self.label}"
        return self.enforce(value)

    def toDict(self):
        return {
            "id": self.id,
            "type": self.input_type,
            "label": self.label,
            "optional": self.optional,
            "hasHandle": self.has_handle,
        }

    def with_id(self, input_id: int):
        self.id = input_id
        return self

    def make_optional(self):
        self.optional = True
        return self

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()
