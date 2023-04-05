from typing import Type

import onnxruntime as ort

from ...impl.onnx.utils import get_input_shape
from .session_base import BaseSession
from .session_cloth import ClothSession
from .session_simple import SimpleSession


def new_session(session: ort.InferenceSession) -> BaseSession:
    session_class: Type[BaseSession]

    input_width = get_input_shape(session)[2]

    # Using size to determine session type and norm parameters is fragile,
    # but at the moment I don't know a better way to detect architecture due
    # to the lack of consistency in naming and outputs across arches and repos.
    # It works right now because of the limited number of models supported,
    # but if that expands, it may become necessary to find an alternative.
    mean = (0.485, 0.456, 0.406)
    std = (0.229, 0.224, 0.225)
    size = (input_width, input_width) if input_width is not None else (320, 320)
    if input_width == 768:  # U2NET cloth model
        session_class = ClothSession
        mean = (0.5, 0.5, 0.5)
        std = (0.5, 0.5, 0.5)
    else:
        session_class = SimpleSession
        if input_width == 1024:  # ISNET
            mean = (0.5, 0.5, 0.5)
            std = (1, 1, 1)
        elif input_width == 512:  # Models trained using anime-segmentation repo
            mean = (0, 0, 0)
            std = (1, 1, 1)

    return session_class(session, mean, std, size)
