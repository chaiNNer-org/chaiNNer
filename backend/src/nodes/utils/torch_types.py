from typing import Union
from .architecture.RRDB import RRDBNet as ESRGAN
from .architecture.SPSR import SPSRNet as SPSR
from .architecture.SRVGG import SRVGGNetCompact as RealESRGANv2
from .architecture.SwiftSRGAN import Generator as SwiftSRGAN
from .architecture.SwinIR import SwinIR
from .architecture.Swin2SR import Swin2SR
from .architecture.GFPGAN.gfpganv1_clean_arch import GFPGANv1Clean
from .architecture.GFPGAN.restoreformer_arch import RestoreFormer

PyTorchSRModels = (RealESRGANv2, SPSR, SwiftSRGAN, ESRGAN, SwinIR, Swin2SR)
PyTorchSRModel = Union[
    RealESRGANv2,
    SPSR,
    SwiftSRGAN,
    ESRGAN,
    SwinIR,
    Swin2SR,
    GFPGANv1Clean,
    RestoreFormer,
]


def isPyTorchSRModel(model: object):
    return isinstance(model, PyTorchSRModels)


PyTorchFaceModels = (GFPGANv1Clean, RestoreFormer)
PyTorchFaceModel = Union[GFPGANv1Clean, RestoreFormer]


def isPyTorchFaceModel(model: object):
    return isinstance(model, PyTorchFaceModels)


PyTorchModels = (*PyTorchSRModels, *PyTorchFaceModels)
PyTorchModel = Union[PyTorchSRModel, PyTorchFaceModel]


def isPyTorchModel(model: object):
    return isinstance(model, PyTorchModels)
