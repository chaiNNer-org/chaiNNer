from typing import Union
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

PyTorchSRModels = (RealESRGANv2, SPSR, SwiftSRGAN, ESRGAN, SwinIR, Swin2SR, HAT)
PyTorchSRModel = Union[
    RealESRGANv2,
    SPSR,
    SwiftSRGAN,
    ESRGAN,
    SwinIR,
    Swin2SR,
    HAT,
]


def isPyTorchSRModel(model: object):
    return isinstance(model, PyTorchSRModels)


PyTorchFaceModels = (GFPGANv1Clean, RestoreFormer, CodeFormer)
PyTorchFaceModel = Union[GFPGANv1Clean, RestoreFormer, CodeFormer]


def isPyTorchFaceModel(model: object):
    return isinstance(model, PyTorchFaceModels)


PyTorchModels = (*PyTorchSRModels, *PyTorchFaceModels)
PyTorchModel = Union[PyTorchSRModel, PyTorchFaceModel]


def isPyTorchModel(model: object):
    return isinstance(model, PyTorchModels)
