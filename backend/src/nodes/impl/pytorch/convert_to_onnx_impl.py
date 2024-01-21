from io import BytesIO

import torch
from spandrel import ImageModelDescriptor, ModelDescriptor


def convert_to_onnx_impl(
    model: ModelDescriptor,
    device: torch.device,
    use_half: bool = False,
    input_name: str = "input",
    output_name: str = "output",
    opset_version: int = 14,
) -> bytes:
    # https://github.com/onnx/onnx/issues/654
    dynamic_axes = {
        input_name: {0: "batch_size", 2: "height", 3: "width"},
        output_name: {0: "batch_size", 2: "height", 3: "width"},
    }
    size = max(model.size_requirements.minimum, 3)
    size = size + (size % model.size_requirements.multiple_of)
    dummy_input = torch.rand(1, model.input_channels, size, size)
    dummy_input = dummy_input.to(device)

    if use_half:
        if not model.supports_half:
            raise ValueError(
                f"Model of arch {model.architecture} does not support half precision."
            )
        model.half()
        dummy_input = dummy_input.half()
    else:
        model.float()
        dummy_input = dummy_input.float()

    m = model.model

    if isinstance(model, ImageModelDescriptor):

        class FakeModel(torch.nn.Module):
            def __init__(self, model: ImageModelDescriptor):
                super().__init__()
                self.model = model

            def forward(self, x: torch.Tensor):
                return self.model(x)

        m = FakeModel(model)

    with BytesIO() as f:
        torch.onnx.export(
            m,
            dummy_input,
            f,
            opset_version=opset_version,
            verbose=False,
            input_names=[input_name],
            output_names=[output_name],
            dynamic_axes=dynamic_axes,
            do_constant_folding=True,
        )
        f.seek(0)
        return f.read()
