from sanic.log import logger

from .architecture.RRDB import RRDBNet as ESRGAN
from .architecture.SPSR import SPSRNet as SPSR
from .architecture.SRVGG import SRVGGNetCompact as RealESRGANv2
from .architecture.SwiftSRGAN import Generator as SwiftSRGAN
from .architecture.SwinIR import SwinIR
from .torch_types import PyTorchModel


def load_state_dict(state_dict) -> PyTorchModel:
    logger.info(f"Loading state dict into pytorch model arch")

    state_dict_keys = list(state_dict.keys())

    if "params_ema" in state_dict_keys:
        state_dict = state_dict["params_ema"]
    if "params-ema" in state_dict_keys:
        state_dict = state_dict["params-ema"]
    if "params" in state_dict_keys:
        state_dict = state_dict["params"]

    # SRVGGNet Real-ESRGAN (v2)
    if "body.0.weight" in state_dict_keys and "body.1.weight" in state_dict_keys:
        model = RealESRGANv2(state_dict)
    # SPSR (ESRGAN with lots of extra layers)
    elif "f_HR_conv1.0.weight" in state_dict:
        model = SPSR(state_dict)
    # Swift-SRGAN
    elif (
        "model" in state_dict_keys
        and "initial.cnn.depthwise.weight" in state_dict["model"].keys()
    ):
        model = SwiftSRGAN(state_dict)
    # SwinIR
    elif "layers.0.residual_group.blocks.0.norm1.weight" in state_dict_keys:
        model = SwinIR(state_dict)
    # Regular ESRGAN, "new-arch" ESRGAN, Real-ESRGAN v1
    else:
        try:
            model = ESRGAN(state_dict)
        except:
            # pylint: disable=raise-missing-from
            raise ValueError("Model unsupported by chaiNNer. Please try another.")
    return model
