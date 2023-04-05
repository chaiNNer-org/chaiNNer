from ...impl.ncnn.model import NcnnModelWrapper
from .base_input import BaseInput


class NcnnModelInput(BaseInput):
    """Input for NcnnModel"""

    def __init__(self, label: str = "Model"):
        super().__init__("NcnnNetwork", label)
        self.associated_type = NcnnModelWrapper
