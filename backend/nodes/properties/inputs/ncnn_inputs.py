from .base_input import BaseInput


class NcnnNetInput(BaseInput):
    """Input for ncnn network"""

    def __init__(self, label: str = "Model"):
        super().__init__(f"ncnn::net", label)
