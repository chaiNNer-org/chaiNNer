class BaseOutput:
    def __init__(
        self,
        output_type: str,
        label: str,
    ):
        self.output_type = output_type
        self.label = label
        self.id = None

    def toDict(self):
        return {
            "id": self.id,
            "type": self.output_type,
            "label": self.label,
        }

    def with_id(self, output_id: int):
        self.id = output_id
        return self

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()
