# This class defines an interface.
# It is important that is does not contain types that depend on ONNX.
class OnnxModel:
    def __init__(self, model_as_bytes: bytes):
        self.bytes: bytes = model_as_bytes
