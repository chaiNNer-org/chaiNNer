from .. import expression
from ..expression import ExpressionJson
from .base_input import BaseInput


class StableDiffusionModelInput(BaseInput):
    def __init__(
        self, label: str = "Model", input_type: ExpressionJson = "StableDiffusionModel"
    ):
        input_type = expression.intersect(
            input_type,
            expression.StableDiffusionModel(),
        )
        super().__init__(input_type, label)


class CLIPModelInput(BaseInput):
    def __init__(self, label: str = "CLIP", input_type: ExpressionJson = "CLIPModel"):
        input_type = expression.intersect(
            input_type,
            expression.CLIPModel(),
        )
        super().__init__(input_type, label)


class VAEModelInput(BaseInput):
    def __init__(self, label: str = "VAE", input_type: ExpressionJson = "VAEModel"):
        super().__init__(input_type, label)


class ConditioningInput(BaseInput):
    def __init__(
        self, label: str = "Conditioning", input_type: ExpressionJson = "Conditioning"
    ):
        input_type = expression.intersect(
            input_type,
            expression.Conditioning(),
        )
        super().__init__(input_type, label)


class LatentImageInput(BaseInput):
    def __init__(
        self, label: str = "Latent", input_type: ExpressionJson = "LatentImage"
    ):
        super().__init__(input_type, label)
