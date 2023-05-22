# Safe unpickler to prevent arbitrary code execution
import pickle
from types import SimpleNamespace

safe_list = {
    ("collections", "OrderedDict"),
    ("typing", "OrderedDict"),
    ("torch._utils", "_rebuild_tensor_v2"),
    ("torch", "BFloat16Storage"),
    ("torch", "FloatStorage"),
    ("torch", "HalfStorage"),
    ("torch", "IntStorage"),
    ("torch", "LongStorage"),
    ("torch", "DoubleStorage"),
}


class RestrictedUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        # Only allow required classes to load state dict
        if (module, name) not in safe_list:
            raise pickle.UnpicklingError(
                "Global '{}.{}' is forbidden".format(module, name)
            )
        return super().find_class(module, name)


RestrictedUnpickle = SimpleNamespace(
    Unpickler=RestrictedUnpickler,
    __name__="pickle",
    load=lambda *args, **kwargs: RestrictedUnpickler(*args, **kwargs).load(),
)
