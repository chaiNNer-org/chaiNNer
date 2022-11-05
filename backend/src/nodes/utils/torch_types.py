from typing import Union
from .architecture.RRDB import RRDBNet as ESRGAN
from .architecture.SPSR import SPSRNet as SPSR
from .architecture.SRVGG import SRVGGNetCompact as RealESRGANv2
from .architecture.SwiftSRGAN import Generator as SwiftSRGAN
from .architecture.SwinIR import SwinIR
from .architecture.Swin2SR import Swin2SR
from .architecture.HAT import HAT
from .architecture.GFPGAN.gfpganv1_clean_arch import GFPGANv1Clean
from .architecture.GFPGAN.restoreformer_arch import RestoreFormer

PyTorchModel = Union[
    RealESRGANv2,
    SPSR,
    SwiftSRGAN,
    ESRGAN,
    SwinIR,
    Swin2SR,
    HAT,
    GFPGANv1Clean,
    RestoreFormer,
]
