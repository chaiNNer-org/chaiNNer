from typing import Union
from .architecture.RRDB import RRDBNet as ESRGAN
from .architecture.SPSR import SPSRNet as SPSR
from .architecture.SRVGG import SRVGGNetCompact as RealESRGANv2
from .architecture.SwiftSRGAN import Generator as SwiftSRGAN

PyTorchModel = Union[RealESRGANv2, SPSR, SwiftSRGAN, ESRGAN]
