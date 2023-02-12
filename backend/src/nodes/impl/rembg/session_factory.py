from typing import Type

import onnxruntime as ort

from ...impl.onnx.utils import get_input_shape
from .session_base import BaseSession
from .session_cloth import ClothSession
from .session_simple import SimpleSession


def new_session(session: ort.InferenceSession) -> BaseSession:
    session_class: Type[BaseSession]

    if get_input_shape(session)[2] == 768:
        session_class = ClothSession
    else:
        session_class = SimpleSession

    return session_class(session)
