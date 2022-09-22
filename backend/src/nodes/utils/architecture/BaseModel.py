from typing import Literal
import torch
import torch.nn as nn

PrecisionModes = Literal["fp32", "fp16", "bf16"]

precision_mode_to_dtype = {
    "fp32": torch.float32,
    "fp16": torch.float16,
    "bf16": torch.bfloat16,
}

# pylint: disable=abstract-method
class BaseModel(nn.Module):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.supports_fp16 = False
        self.supports_bfp16 = False
        self.precision_mode = "fp32"

    def to_precision_mode(self, x, precision_mode: PrecisionModes):
        if precision_mode == "fp32":
            return x.float()
        elif precision_mode == "fp16" and self.supports_fp16:
            return x.half()
        elif precision_mode == "bf16" and self.supports_bf16:
            return x.bfloat16()
        else:
            return x

    def to_self_precision(self, precision_mode: PrecisionModes):
        if precision_mode == self.precision_mode:
            return
        if precision_mode == "fp32":
            self.float()
            self.precision_mode = precision_mode
        elif precision_mode == "fp16" and self.supports_fp16:
            self.half()
            self.precision_mode = precision_mode
        elif precision_mode == "bf16" and self.supports_bfp16:
            self.bfloat16()
            self.precision_mode = precision_mode
        else:
            return

    def to_paired_precision(
        self, precision_mode: PrecisionModes, x: torch.Tensor
    ) -> torch.Tensor:
        if (
            precision_mode == self.precision_mode
            and x.dtype == precision_mode_to_dtype[self.precision_mode]
        ):
            return x
        else:
            self.to_self_precision(precision_mode)
            return_value = self.to_precision_mode(x, precision_mode)
            self.precision_mode = precision_mode
            return return_value
