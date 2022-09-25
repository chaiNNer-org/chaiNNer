from __future__ import annotations
from ncnn_vulkan import ncnn
from weakref import WeakKeyDictionary

from .exec_options import ExecutionOptions
from .ncnn_model import NcnnModel


def create_ncnn_net(model: NcnnModel, exec_options: ExecutionOptions) -> ncnn.Net:
    net = ncnn.Net()

    # Use vulkan compute
    net.opt.use_vulkan_compute = True
    net.set_vulkan_device(exec_options.ncnn_gpu_index)

    # Load model param and bin
    net.load_param_mem(model.write_param())
    net.load_model_mem(model.weights_bin)

    # Attribute not needed anymore, save memory
    model.weights_bin = b""

    return net


__session_cache: WeakKeyDictionary[NcnnModel, ncnn.Net] = WeakKeyDictionary()


def get_ncnn_net(model: NcnnModel, exec_options: ExecutionOptions) -> ncnn.Net:
    cached = __session_cache.get(model)
    if cached is None:
        cached = create_ncnn_net(model, exec_options)
        __session_cache[model] = cached
    return cached
