from sanic.log import logger

from .architecture.RRDB import RRDBNet as ESRGAN
from .architecture.SPSR import SPSRNet as SPSR
from .architecture.SRVGG import SRVGGNetCompact as RealESRGANv2
from .architecture.SwiftSRGAN import Generator as SwiftSRGAN
from .architecture.SwinIR import SwinIR
from .architecture.Swin2SR import Swin2SR
from .architecture.HAT import HAT
from .architecture.face_arches.gfpganv1_clean_arch import GFPGANv1Clean
from .architecture.face_arches.restoreformer_arch import RestoreFormer
from .architecture.face_arches.codeformer import CodeFormer
from .torch_types import PyTorchModel


def load_state_dict(state_dict) -> PyTorchModel:
    logger.debug(f"Loading state dict into pytorch model arch")

    state_dict_keys = list(state_dict.keys())

    if "params_ema" in state_dict_keys:
        state_dict = state_dict["params_ema"]
    elif "params-ema" in state_dict_keys:
        state_dict = state_dict["params-ema"]
    elif "params" in state_dict_keys:
        state_dict = state_dict["params"]

    state_dict_keys = list(state_dict.keys())
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
    # HAT -- be sure it is above swinir
    elif "layers.0.residual_group.blocks.0.conv_block.cab.0.weight" in state_dict_keys:
        model = HAT(state_dict)
    # SwinIR
    elif "layers.0.residual_group.blocks.0.norm1.weight" in state_dict_keys:
        if "patch_embed.proj.weight" in state_dict_keys:
            model = Swin2SR(state_dict)
        else:
            model = SwinIR(state_dict)
    # GFPGAN
    elif (
        "toRGB.0.weight" in state_dict_keys
        and "stylegan_decoder.style_mlp.1.weight" in state_dict_keys
    ):
        model = GFPGANv1Clean(state_dict)
    # RestoreFormer
    elif (
        "encoder.conv_in.weight" in state_dict_keys
        and "encoder.down.0.block.0.norm1.weight" in state_dict_keys
    ):
        model = RestoreFormer(state_dict)
    elif (
        "encoder.blocks.0.weight" in state_dict_keys
        and "quantize.embedding.weight" in state_dict_keys
    ):
        model = CodeFormer(state_dict)
    # Regular ESRGAN, "new-arch" ESRGAN, Real-ESRGAN v1
    else:
        try:
            model = ESRGAN(state_dict)
        except:
            # pylint: disable=raise-missing-from
            raise ValueError("Model unsupported by chaiNNer. Please try another.")
    return model
