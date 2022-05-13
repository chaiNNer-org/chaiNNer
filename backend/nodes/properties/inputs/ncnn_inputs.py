from .base_input import BaseInput


class NcnnNetInput(BaseInput):
    """Input for ncnn network"""

    def __init__(self, label: str = "Network"):
        super().__init__(f"ncnn::net", label)
