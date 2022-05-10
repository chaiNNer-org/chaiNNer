class BaseInput:
    def __init__(self, input_type: str, label: str, optional=False):
        self.input_type = input_type
        self.label = label
        self.optional = optional

    def enforce(self, value):
        """Enforce the input type"""
        return value

    def toDict(self):
        return {
            "type": self.input_type,
            "label": self.label,
            "optional": self.optional,
        }

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()
