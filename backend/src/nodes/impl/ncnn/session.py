from __future__ import annotations

import tempfile
from weakref import WeakKeyDictionary

try:
    from ncnn_vulkan import ncnn

    use_gpu = True
except ImportError:
    from ncnn import ncnn

    use_gpu = False

from ...utils.exec_options import ExecutionOptions
from .model import NcnnModelWrapper


def create_ncnn_net(model: NcnnModelWrapper, gpu_index: int) -> ncnn.Net:
    net = ncnn.Net()

    if model.fp == "fp16":
        net.opt.use_fp16_packed = True
        net.opt.use_fp16_storage = True
        net.opt.use_fp16_arithmetic = True
    else:
        net.opt.use_fp16_packed = False
        net.opt.use_fp16_storage = False
        net.opt.use_fp16_arithmetic = False

    if use_gpu:
        # Use vulkan compute
        net.opt.use_vulkan_compute = True
        net.set_vulkan_device(gpu_index)

    # Load model param and bin
    if use_gpu:
        net.load_param_mem(model.model.write_param())
        net.load_model_mem(model.model.bin)
    else:
        with tempfile.TemporaryDirectory() as tmp_model_dir:
            param_filename = tmp_model_dir + "/ncnn-model.param"
            bin_filename = tmp_model_dir + "/ncnn-model.bin"

            model.model.write_param(param_filename)
            model.model.write_bin(bin_filename)

            net.load_param(param_filename)
            net.load_model(bin_filename)

    return net


__session_cache: WeakKeyDictionary[NcnnModelWrapper, ncnn.Net] = WeakKeyDictionary()


def get_ncnn_net(model: NcnnModelWrapper, gpu_index: int) -> ncnn.Net:
    cached = __session_cache.get(model)
    if cached is None:
        cached = create_ncnn_net(model, gpu_index)
        __session_cache[model] = cached
    return cached
