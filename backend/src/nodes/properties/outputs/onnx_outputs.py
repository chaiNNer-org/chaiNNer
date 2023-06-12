import navi
from nodes.base_output import BaseOutput

from ...impl.onnx.model import OnnxModel


class OnnxModelOutput(BaseOutput):
    """Output for onnx model"""

    def __init__(
        self,
        model_type: navi.ExpressionJson = "OnnxModel",
        label: str = "Model",
    ):
        super().__init__(model_type, label, associated_type=OnnxModel)

    def get_broadcast_type(self, value: OnnxModel):
        fields = {
            "subType": navi.literal(value.sub_type),
        }

        if value.scale_width:
            fields["scaleWidth"] = value.scale_width
        if value.scale_height:
            fields["scaleHeight"] = value.scale_height

        return navi.named("OnnxModel", fields)
