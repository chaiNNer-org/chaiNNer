from ..sanic_ext.bootstrap import Extend
from ..sanic_ext.config import Config
from ..sanic_ext.extensions.http.cors import cors
from ..sanic_ext.extras.serializer.decorator import serializer
from ..sanic_ext.extras.validation.decorator import validate

__version__ = "21.12.1"
__all__ = [
    "Config",
    "Extend",
    "cors",
    "serializer",
    "validate",
]
