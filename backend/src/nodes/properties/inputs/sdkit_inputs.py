from .base_input import BaseInput


class SDKitModelInput(BaseInput):
    def __init__(self, label: str = "Model"):
        super().__init__("SDKitModel", label=label)
