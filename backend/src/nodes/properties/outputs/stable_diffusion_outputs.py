from nodes.impl.stable_diffusion import (
    CLIPModel,
    Conditioning,
    LatentImage,
    StableDiffusionModel,
)
from .. import expression
from .base_output import BaseOutput


class StableDiffusionModelOutput(BaseOutput):
    def __init__(
        self,
        model_type: expression.ExpressionJson = "StableDiffusionModel",
        label: str = "Model",
    ):
        super().__init__(model_type, label)

    def get_broadcast_type(self, value: StableDiffusionModel):
        return expression.StableDiffusionModel(
            arch=expression.literal(value.version.value),
        )


class CLIPModelOutput(BaseOutput):
    def __init__(
        self,
        model_type: expression.ExpressionJson = "CLIPModel",
        label: str = "CLIP",
    ):
        super().__init__(model_type, label)

    def get_broadcast_type(self, value: CLIPModel):
        return expression.CLIPModel(
            arch=expression.literal(value.version.value),
        )


class VAEModelOutput(BaseOutput):
    def __init__(
        self,
        model_type: expression.ExpressionJson = "VAEModel",
        label: str = "VAE",
    ):
        super().__init__(model_type, label)


class ConditioningOutput(BaseOutput):
    def __init__(
        self,
        model_type: expression.ExpressionJson = "Conditioning",
        label: str = "Conditioning",
    ):
        super().__init__(model_type, label)

    def get_broadcast_type(self, value: Conditioning):
        return expression.Conditioning(
            arch=expression.literal(value.version.value),
        )


class LatentImageOutput(BaseOutput):
    def __init__(
        self,
        image_type: expression.ExpressionJson = "LatentImage",
        label: str = "Latent",
    ):
        super().__init__(image_type, label)

    def get_broadcast_type(self, value: LatentImage):
        w, h = value.size()

        return expression.named(
            "LatentImage",
            {
                "width": w * 64,
                "height": h * 64,
            },
        )
