from sanic.log import logger


class BaseInput:
    def __init__(self, input_type: str, label: str, optional=False, has_handle=True):
        self.input_type = input_type
        self.label = label
        self.optional = optional
        self.has_handle = has_handle

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
            "type": self.input_type,
            "label": self.label,
            "optional": self.optional,
            "hasHandle": self.has_handle,
        }

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()
