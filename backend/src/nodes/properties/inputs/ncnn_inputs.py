from .base_input import BaseInput


class NcnnNetInput(BaseInput):
    """Input for ncnn network"""

    def __init__(self, label: str = "Model"):
        super().__init__("NcnnNetwork", label)


class NcnnModelInput(BaseInput):
    """Input for NcnnModel"""

    def __init__(self, label: str = "Model"):
        super().__init__("NcnnNetwork", label)
