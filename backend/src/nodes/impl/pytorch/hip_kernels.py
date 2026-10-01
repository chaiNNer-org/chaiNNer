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


_ATTN_SRC = r"""
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
    u += 0x7FFFu + ((u >> 16) & 1u);
    p[i] = (bf16_t)(u >> 16);
}
__device__ __forceinline__ void copy_val(float* d, long di, const float* s, long si) { d[di] = s[si]; }
__device__ __forceinline__ void copy_val(_Float16* d, long di, const _Float16* s, long si) { d[di] = s[si]; }
__device__ __forceinline__ void copy_val(bf16_t* d, long di, const bf16_t* s, long si) { d[di] = s[si]; }

#define CH 16

typedef float f2v __attribute__((ext_vector_type(2)));
typedef unsigned int u2v __attribute__((ext_vector_type(2)));
typedef _Float16 h4v __attribute__((ext_vector_type(4)));

// 8-byte read from shared memory, unpacked to floats
__device__ __forceinline__ void load8(const float* p, float* o) {
    f2v v = *(const f2v*)p; o[0] = v.x; o[1] = v.y;
}
__device__ __forceinline__ void load8(const _Float16* p, float* o) {
    h4v v = *(const h4v*)p; o[0] = (float)v.x; o[1] = (float)v.y; o[2] = (float)v.z; o[3] = (float)v.w;
}
__device__ __forceinline__ void load8(const bf16_t* p, float* o) {
    u2v v = *(const u2v*)p;
    o[0] = __uint_as_float(v.x << 16); o[1] = __uint_as_float(v.x & 0xFFFF0000u);
    o[2] = __uint_as_float(v.y << 16); o[3] = __uint_as_float(v.y & 0xFFFF0000u);
}

// DAT window attention, fused: softmax(q*scale @ k^T + bias + shift_mask) @ v
// for one (window, head) per block and one query token per thread.
//
// qkv:    (3, B, L, heads*d) with arbitrary strides s0..s3 (elements), L = H*W
// biasT:  (heads, N, N) float, transposed: biasT[h][key][query], or null
// labels: (nW, N) int region id per token of each window, or null. Tokens of
//         different regions get -100 added, exactly like DAT's shift mask.
// out:    (B, H, W, heads*d) contiguous
//
// K and V rows are padded to DP (a multiple of the 8-byte vector width) and
// zero filled, so the inner loops read shared memory 8 bytes at a time.
template <typename T, int DMAX>
__device__ void win_attn(const T* __restrict__ qkv, long s0, long s1, long s2, long s3,
                         const float* __restrict__ biasT, const int* __restrict__ labels,
                         T* __restrict__ out, int H, int W, int H_sp, int W_sp,
                         int heads, int d, float scale) {
    constexpr int VEC = 8 / sizeof(T);
    extern __shared__ unsigned char lds_raw[];
    const int N = H_sp * W_sp;
    const int DP = (d + VEC - 1) / VEC * VEC;
    T* Ks = (T*)lds_raw;
    T* Vs = Ks + N * DP;
    int* labs = (int*)(Vs + N * DP);

    const int nw = W / W_sp, nh = H / H_sp, nW = nh * nw;
    const int h = blockIdx.x % heads;
    const int win = blockIdx.x / heads;
    const int b = win / nW, wimg = win % nW;
    const int ih = wimg / nw, iw = wimg % nw;
    const int n = threadIdx.x;
    const int y = ih * H_sp + n / W_sp, x = iw * W_sp + n % W_sp;
    const long base = (long)b * s1 + ((long)y * W + x) * s2 + (long)(h * d) * s3;

    float q[DMAX];
    #pragma unroll
    for (int j = 0; j < DMAX; j++) {
        if (j < d) {
            q[j] = load_val(qkv, base + j * s3) * scale;
            copy_val(Ks, n * DP + j, qkv, s0 + base + j * s3);
            copy_val(Vs, n * DP + j, qkv, 2 * s0 + base + j * s3);
        } else {
            q[j] = 0.0f;
            if (j < DP) { store_val(Ks, n * DP + j, 0.0f); store_val(Vs, n * DP + j, 0.0f); }
        }
    }
    if (labels) labs[n] = labels[wimg * N + n];
    __syncthreads();

    const int lab = labels ? labs[n] : 0;
    const float* bcol = biasT ? biasT + (long)h * N * N + n : nullptr;
    float m = -__builtin_inff(), lsum = 0.0f, acc[DMAX];
    #pragma unroll
    for (int j = 0; j < DMAX; j++) acc[j] = 0.0f;

    for (int k0 = 0; k0 < N; k0 += CH) {
        float s[CH];
        float cm = -__builtin_inff();
        #pragma unroll
        for (int c = 0; c < CH; c++) {
            const T* krow = Ks + (k0 + c) * DP;
            float dot = 0.0f;
            #pragma unroll
            for (int j = 0; j < DMAX; j += VEC) {
                if (j < DP) {
                    float kv[VEC];
                    load8(krow + j, kv);
                    #pragma unroll
                    for (int e = 0; e < VEC; e++) dot += q[j + e] * kv[e];
                }
            }
            if (bcol) dot += bcol[(long)(k0 + c) * N];
            if (labels && labs[k0 + c] != lab) dot -= 100.0f;
            s[c] = dot;
            cm = fmaxf(cm, dot);
        }
        const float mn = fmaxf(m, cm);
        const float corr = __expf(m - mn);
        lsum *= corr;
        #pragma unroll
        for (int j = 0; j < DMAX; j++) acc[j] *= corr;
        #pragma unroll
        for (int c = 0; c < CH; c++) {
            const float p = __expf(s[c] - mn);
            lsum += p;
            const T* vrow = Vs + (k0 + c) * DP;
            #pragma unroll
            for (int j = 0; j < DMAX; j += VEC) {
                if (j < DP) {
                    float vv[VEC];
                    load8(vrow + j, vv);
                    #pragma unroll
                    for (int e = 0; e < VEC; e++) acc[j + e] += p * vv[e];
                }
            }
        }
        m = mn;
    }

    const float inv = 1.0f / lsum;
    const long ob = (((long)b * H + y) * W + x) * (long)(heads * d) + h * d;
    #pragma unroll
    for (int j = 0; j < DMAX; j++)
        if (j < d) store_val(out, ob + j, acc[j] * inv);
}

#define ATTN_ARGS long s0, long s1, long s2, long s3, const float* biasT, const int* labels, int H, int W, int H_sp, int W_sp, int heads, int d, float scale
#define ATTN_PASS s0, s1, s2, s3, biasT, labels
#define ATTN_TAIL H, W, H_sp, W_sp, heads, d, scale
extern "C" __global__ void win_attn_f32_32(const float* qkv, float* out, ATTN_ARGS) { win_attn<float, 32>(qkv, ATTN_PASS, out, ATTN_TAIL); }
extern "C" __global__ void win_attn_f32_64(const float* qkv, float* out, ATTN_ARGS) { win_attn<float, 64>(qkv, ATTN_PASS, out, ATTN_TAIL); }
extern "C" __global__ void win_attn_f16_32(const _Float16* qkv, _Float16* out, ATTN_ARGS) { win_attn<_Float16, 32>(qkv, ATTN_PASS, out, ATTN_TAIL); }
extern "C" __global__ void win_attn_f16_64(const _Float16* qkv, _Float16* out, ATTN_ARGS) { win_attn<_Float16, 64>(qkv, ATTN_PASS, out, ATTN_TAIL); }
extern "C" __global__ void win_attn_bf16_32(const bf16_t* qkv, bf16_t* out, ATTN_ARGS) { win_attn<bf16_t, 32>(qkv, ATTN_PASS, out, ATTN_TAIL); }
extern "C" __global__ void win_attn_bf16_64(const bf16_t* qkv, bf16_t* out, ATTN_ARGS) { win_attn<bf16_t, 64>(qkv, ATTN_PASS, out, ATTN_TAIL); }
"""

_TW, _TH = 32, 16
_MAX_GRID_Z = 65535
_DTYPE_SUFFIX = {torch.float32: "f32", torch.float16: "f16", torch.bfloat16: "bf16"}
_PROGRAMS = {
    "dwconv": (_DWCONV_SRC, [f"dwconv3x3_{s}" for s in _DTYPE_SUFFIX.values()]),
    "win_attn": (
        _ATTN_SRC,
        [f"win_attn_{s}_{dm}" for s in _DTYPE_SUFFIX.values() for dm in (32, 64)],
    ),
}
_LDS_LIMIT = 64 * 1024


class _Hip:
    def __init__(self):
        bin_dir = self._find_bin_dir()
        os.add_dll_directory(str(bin_dir))
        self.hip = ctypes.WinDLL(str(next(bin_dir.glob("amdhip64*.dll"))))
        self.rtc = ctypes.WinDLL(str(next(bin_dir.glob("hiprtc0*.dll"))))
        self.funcs: dict[tuple[int, str], ctypes.c_void_p] = {}
        self.compiled: set[tuple[int, str]] = set()
        self.lock = threading.Lock()

    @staticmethod
    def _find_bin_dir() -> Path:
        import _rocm_sdk_core  # type: ignore

        return Path(_rocm_sdk_core.__file__).parent / "bin"

    @staticmethod
    def _check(err: int, what: str) -> None:
        if err != 0:
            raise RuntimeError(f"{what} failed with HIP error {err}")

    def _compile(self, device_index: int, program: str) -> None:
        source, names = _PROGRAMS[program]
        arch = torch.cuda.get_device_properties(device_index).gcnArchName.split(":")[0]
        prog = ctypes.c_void_p()
        self._check(
            self.rtc.hiprtcCreateProgram(
                ctypes.byref(prog), source.encode(), f"{program}.hip".encode(), 0, None, None
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
            for name in names:
                fn = ctypes.c_void_p()
                self._check(
                    self.hip.hipModuleGetFunction(ctypes.byref(fn), module, name.encode()),
                    "hipModuleGetFunction",
                )
                self.funcs[(device_index, name)] = fn
        logger.info("Compiled HIP %s kernels for %s", program, arch)

    def get(self, device_index: int, program: str, name: str) -> ctypes.c_void_p:
        fn = self.funcs.get((device_index, name))
        if fn is None:
            with self.lock:
                if (device_index, program) not in self.compiled:
                    self._compile(device_index, program)
                    self.compiled.add((device_index, program))
                fn = self.funcs[(device_index, name)]
        return fn

    def launch(self, fn, grid, block, args, stream, shared_mem: int = 0) -> None:
        params = (ctypes.c_void_p * len(args))(
            *[ctypes.cast(ctypes.byref(a), ctypes.c_void_p) for a in args]
        )
        self._check(
            self.hip.hipModuleLaunchKernel(fn, *grid, *block, shared_mem, stream, params, None),
            "hipModuleLaunchKernel",
        )


_hip: _Hip | None = None
_hip_lock = threading.Lock()


def hip_kernels_available() -> bool:
    """Only for AMD's ROCm builds of PyTorch on Windows, where HIPRTC ships with torch."""
    if os.environ.get("CHAINNER_HIP_KERNELS", "").strip() == "0":
        return False
    return sys.platform == "win32" and bool(torch.version.hip) and torch.cuda.is_available()


def _get_hip() -> _Hip:
    global _hip
    if _hip is None:
        with _hip_lock:
            if _hip is None:
                _hip = _Hip()
    return _hip


def _stream(t: torch.Tensor) -> ctypes.c_void_p:
    return ctypes.c_void_p(torch.cuda.current_stream(t.device).cuda_stream)


# --- depthwise 3x3 convolution ----------------------------------------------


def can_dwconv3x3(x: torch.Tensor) -> bool:
    return (
        x.is_cuda
        and x.dim() == 4
        and x.dtype in _DTYPE_SUFFIX
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
    fn = hip.get(x.device.index or 0, "dwconv", f"dwconv3x3_{_DTYPE_SUFFIX[x.dtype]}")
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
    grid = ((W + _TW - 1) // _TW, (H + _TH - 1) // _TH, B * C)
    hip.launch(fn, grid, (_TW, _TH, 1), args, _stream(x))
    return y


# --- DAT window attention ------------------------------------------------------


def _attn_lds_bytes(n: int, d: int, dtype: torch.dtype) -> int:
    # must match the kernel: K/V rows padded to a multiple of the 8-byte vector
    elem = torch.tensor([], dtype=dtype).element_size()
    vec = 8 // elem
    dp = (d + vec - 1) // vec * vec
    return 2 * n * dp * elem + n * 4


def can_window_attention(
    qkv: torch.Tensor, H: int, W: int, H_sp: int, W_sp: int, heads: int  # noqa: N803
) -> bool:
    n = H_sp * W_sp
    if not (qkv.is_cuda and qkv.dim() == 4 and qkv.dtype in _DTYPE_SUFFIX):
        return False
    if qkv.requires_grad or H % H_sp or W % W_sp or n % 16 or n > 1024:
        return False
    c = qkv.shape[-1]
    if c % heads:
        return False
    d = c // heads
    return d <= 64 and _attn_lds_bytes(n, d, qkv.dtype) <= _LDS_LIMIT


def window_attention(
    qkv: torch.Tensor,
    H: int,  # noqa: N803
    W: int,  # noqa: N803
    H_sp: int,  # noqa: N803
    W_sp: int,  # noqa: N803
    heads: int,
    scale: float,
    bias_t: torch.Tensor | None,
    labels: torch.Tensor | None,
) -> torch.Tensor:
    """
    DAT window attention for one branch, fused into a single kernel.

    qkv: (3, B, H*W, heads*d), any strides. bias_t: (heads, N, N) float32,
    transposed (key, query), contiguous. labels: (nW, N) int32 contiguous.
    Returns (B, H, W, heads*d), like DAT's windows2img.
    """
    _, B, L, C = qkv.shape
    d = C // heads
    n = H_sp * W_sp
    hip = _get_hip()
    name = f"win_attn_{_DTYPE_SUFFIX[qkv.dtype]}_{32 if d <= 32 else 64}"
    fn = hip.get(qkv.device.index or 0, "win_attn", name)
    out = torch.empty((B, H, W, C), device=qkv.device, dtype=qkv.dtype)
    s0, s1, s2, s3 = qkv.stride()
    args = [
        ctypes.c_void_p(qkv.data_ptr()),
        ctypes.c_void_p(out.data_ptr()),
        ctypes.c_int64(s0),
        ctypes.c_int64(s1),
        ctypes.c_int64(s2),
        ctypes.c_int64(s3),
        ctypes.c_void_p(bias_t.data_ptr() if bias_t is not None else 0),
        ctypes.c_void_p(labels.data_ptr() if labels is not None else 0),
        ctypes.c_int(H),
        ctypes.c_int(W),
        ctypes.c_int(H_sp),
        ctypes.c_int(W_sp),
        ctypes.c_int(heads),
        ctypes.c_int(d),
        ctypes.c_float(scale),
    ]
    blocks = B * (H // H_sp) * (W // W_sp) * heads
    hip.launch(fn, (blocks, 1, 1), (n, 1, 1), args, _stream(qkv), _attn_lds_bytes(n, d, qkv.dtype))
    return out
