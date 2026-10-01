from __future__ import annotations

import ctypes
import os
import sys
import threading
from pathlib import Path

import torch

from logger import logger

# Custom HIP kernels for operations that MIOpen handles poorly on consumer
# Radeon cards. They are compiled at runtime with HIPRTC, which ships with
# AMD's ROCm wheels, for whatever GPU architecture is present, and launched on
# PyTorch's current stream. No compiler or SDK has to be installed.

_DWCONV_SRC = r"""
typedef unsigned short bf16_t;

__device__ __forceinline__ float load_val(const float* p, long i) { return p[i]; }
__device__ __forceinline__ float load_val(const _Float16* p, long i) { return (float)p[i]; }
__device__ __forceinline__ float load_val(const bf16_t* p, long i) {
    return __uint_as_float(((unsigned int)p[i]) << 16);
}
__device__ __forceinline__ void store_val(float* p, long i, float v) { p[i] = v; }
__device__ __forceinline__ void store_val(_Float16* p, long i, float v) { p[i] = (_Float16)v; }
__device__ __forceinline__ void store_val(bf16_t* p, long i, float v) {
    unsigned int u = __float_as_uint(v);
    u += 0x7FFFu + ((u >> 16) & 1u);  // round to nearest even
    p[i] = (bf16_t)(u >> 16);
}

#define TW 32
#define TH 16

// Depthwise 3x3 convolution, stride 1, zero padding 1, NCHW layout.
// Each block loads a (TH+2) x (TW+2) tile of one channel into shared memory,
// so every input value is read from global memory about once. Accumulates
// in fp32 regardless of the storage type.
template <typename T>
__device__ void dwconv3x3(const T* __restrict__ x, const float* __restrict__ w,
                          const float* __restrict__ b, T* __restrict__ y,
                          int C, int H, int W) {
    __shared__ float tile[TH + 2][TW + 2];
    const int bc = blockIdx.z;  // batch * C + channel
    const int c = bc % C;
    const long plane = (long)bc * H * W;
    const int x0 = blockIdx.x * TW, y0 = blockIdx.y * TH;
    const int tid = threadIdx.y * TW + threadIdx.x;

    for (int i = tid; i < (TH + 2) * (TW + 2); i += TW * TH) {
        int ty = i / (TW + 2), tx = i % (TW + 2);
        int gy = y0 + ty - 1, gx = x0 + tx - 1;
        tile[ty][tx] = (gy >= 0 && gy < H && gx >= 0 && gx < W)
            ? load_val(x, plane + (long)gy * W + gx) : 0.0f;
    }
    __syncthreads();

    const int ox = x0 + threadIdx.x, oy = y0 + threadIdx.y;
    if (ox >= W || oy >= H) return;
    const float* k = w + c * 9;
    float acc = b ? b[c] : 0.0f;
    #pragma unroll
    for (int i = 0; i < 3; i++)
        #pragma unroll
        for (int j = 0; j < 3; j++)
            acc += tile[threadIdx.y + i][threadIdx.x + j] * k[i * 3 + j];
    store_val(y, plane + (long)oy * W + ox, acc);
}

extern "C" __global__ void dwconv3x3_f32(const float* x, const float* w, const float* b, float* y, int C, int H, int W) { dwconv3x3<float>(x, w, b, y, C, H, W); }
extern "C" __global__ void dwconv3x3_f16(const _Float16* x, const float* w, const float* b, _Float16* y, int C, int H, int W) { dwconv3x3<_Float16>(x, w, b, y, C, H, W); }
extern "C" __global__ void dwconv3x3_bf16(const bf16_t* x, const float* w, const float* b, bf16_t* y, int C, int H, int W) { dwconv3x3<bf16_t>(x, w, b, y, C, H, W); }
"""

_TW, _TH = 32, 16
_MAX_GRID_Z = 65535
_DWCONV_FUNCS = {
    torch.float32: b"dwconv3x3_f32",
    torch.float16: b"dwconv3x3_f16",
    torch.bfloat16: b"dwconv3x3_bf16",
}


class _Hip:
    def __init__(self):
        bin_dir = self._find_bin_dir()
        os.add_dll_directory(str(bin_dir))
        self.hip = ctypes.WinDLL(str(next(bin_dir.glob("amdhip64*.dll"))))
        self.rtc = ctypes.WinDLL(str(next(bin_dir.glob("hiprtc0*.dll"))))
        self.funcs: dict[tuple[int, torch.dtype], ctypes.c_void_p] = {}
        self.lock = threading.Lock()

    @staticmethod
    def _find_bin_dir() -> Path:
        import _rocm_sdk_core  # type: ignore

        return Path(_rocm_sdk_core.__file__).parent / "bin"

    @staticmethod
    def _check(err: int, what: str) -> None:
        if err != 0:
            raise RuntimeError(f"{what} failed with HIP error {err}")

    def _compile(self, device_index: int) -> None:
        arch = torch.cuda.get_device_properties(device_index).gcnArchName.split(":")[0]
        prog = ctypes.c_void_p()
        self._check(
            self.rtc.hiprtcCreateProgram(
                ctypes.byref(prog), _DWCONV_SRC.encode(), b"dwconv.hip", 0, None, None
            ),
            "hiprtcCreateProgram",
        )
        try:
            opts = [f"--offload-arch={arch}".encode(), b"-O3"]
            err = self.rtc.hiprtcCompileProgram(
                prog, len(opts), (ctypes.c_char_p * len(opts))(*opts)
            )
            if err != 0:
                size = ctypes.c_size_t()
                self.rtc.hiprtcGetProgramLogSize(prog, ctypes.byref(size))
                log = ctypes.create_string_buffer(size.value)
                self.rtc.hiprtcGetProgramLog(prog, log)
                raise RuntimeError(
                    "HIPRTC compilation failed: " + log.value.decode(errors="replace")
                )
            size = ctypes.c_size_t()
            self._check(self.rtc.hiprtcGetCodeSize(prog, ctypes.byref(size)), "hiprtcGetCodeSize")
            code = ctypes.create_string_buffer(size.value)
            self._check(self.rtc.hiprtcGetCode(prog, code), "hiprtcGetCode")
        finally:
            self.rtc.hiprtcDestroyProgram(ctypes.byref(prog))

        with torch.cuda.device(device_index):
            torch.cuda.current_stream(device_index)  # ensure the context exists
            module = ctypes.c_void_p()
            self._check(self.hip.hipModuleLoadData(ctypes.byref(module), code), "hipModuleLoadData")
            for dtype, name in _DWCONV_FUNCS.items():
                fn = ctypes.c_void_p()
                self._check(
                    self.hip.hipModuleGetFunction(ctypes.byref(fn), module, name),
                    "hipModuleGetFunction",
                )
                self.funcs[(device_index, dtype)] = fn
        logger.info("Compiled HIP depthwise conv kernel for %s", arch)

    def get(self, device_index: int, dtype: torch.dtype) -> ctypes.c_void_p:
        key = (device_index, dtype)
        fn = self.funcs.get(key)
        if fn is None:
            with self.lock:
                if key not in self.funcs:
                    self._compile(device_index)
                fn = self.funcs[key]
        return fn

    def launch(self, fn, grid, block, args, stream) -> None:
        params = (ctypes.c_void_p * len(args))(
            *[ctypes.cast(ctypes.byref(a), ctypes.c_void_p) for a in args]
        )
        self._check(
            self.hip.hipModuleLaunchKernel(fn, *grid, *block, 0, stream, params, None),
            "hipModuleLaunchKernel",
        )


_hip: _Hip | None = None
_hip_lock = threading.Lock()


def hip_kernels_available() -> bool:
    """Only for AMD's ROCm builds of PyTorch on Windows, where HIPRTC ships with torch."""
    if os.environ.get("CHAINNER_HIP_DWCONV", "").strip() == "0":
        return False
    return sys.platform == "win32" and bool(torch.version.hip) and torch.cuda.is_available()


def _get_hip() -> _Hip:
    global _hip
    if _hip is None:
        with _hip_lock:
            if _hip is None:
                _hip = _Hip()
    return _hip


def can_dwconv3x3(x: torch.Tensor) -> bool:
    return (
        x.is_cuda
        and x.dim() == 4
        and x.dtype in _DWCONV_FUNCS
        and not x.requires_grad
        and x.shape[0] * x.shape[1] <= _MAX_GRID_Z
    )


def dwconv3x3(x: torch.Tensor, weight: torch.Tensor, bias: torch.Tensor | None) -> torch.Tensor:
    """
    Depthwise 3x3 convolution, stride 1, zero padding 1.

    x: (B, C, H, W). weight: (C, 9) float32 contiguous. bias: (C,) float32 or None.
    """
    x = x.contiguous()
    B, C, H, W = x.shape
    hip = _get_hip()
    fn = hip.get(x.device.index or 0, x.dtype)
    y = torch.empty_like(x)
    args = [
        ctypes.c_void_p(x.data_ptr()),
        ctypes.c_void_p(weight.data_ptr()),
        ctypes.c_void_p(bias.data_ptr() if bias is not None else 0),
        ctypes.c_void_p(y.data_ptr()),
        ctypes.c_int(C),
        ctypes.c_int(H),
        ctypes.c_int(W),
    ]
    stream = ctypes.c_void_p(torch.cuda.current_stream(x.device).cuda_stream)
    grid = ((W + _TW - 1) // _TW, (H + _TH - 1) // _TH, B * C)
    hip.launch(fn, grid, (_TW, _TH, 1), args, stream)
    return y
