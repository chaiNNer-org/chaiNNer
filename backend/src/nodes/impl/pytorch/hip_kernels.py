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
                         T* __restrict__ out, long out_stride, int out_off, int Hc, int Wc,
                         int sy, int sx, int H, int W, int H_sp, int W_sp,
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
    // (y, x) in the (rolled) window grid; (ys, xs) where that token really is.
    // A roll by -s before attention and by +s after is the same as reading and
    // writing at (y + s) mod size, so DAT's torch.roll copies are not needed.
    const int y = ih * H_sp + n / W_sp, x = iw * W_sp + n % W_sp;
    const int ys = (y + sy) % H, xs = (x + sx) % W;
    // positions past the Hc x Wc image are the window padding: zero q/k/v,
    // exactly like DAT's F.pad, without materializing the padded copy
    const bool valid = ys < Hc && xs < Wc;
    const long base = (long)b * s1 + ((long)ys * Wc + xs) * s2 + (long)(h * d) * s3;

    float q[DMAX];
    #pragma unroll
    for (int j = 0; j < DMAX; j++) {
        if (j < d && valid) {
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

    // write into (B, Hc, Wc, out_stride) at channel out_off, cropping padding
    if (ys >= Hc || xs >= Wc) return;
    const float inv = 1.0f / lsum;
    const long ob = (((long)b * Hc + ys) * Wc + xs) * out_stride + out_off + h * d;
    #pragma unroll
    for (int j = 0; j < DMAX; j++)
        if (j < d) store_val(out, ob + j, acc[j] * inv);
}

#define ATTN_ARGS long s0, long s1, long s2, long s3, const float* biasT, const int* labels, long out_stride, int out_off, int Hc, int Wc, int sy, int sx, int H, int W, int H_sp, int W_sp, int heads, int d, float scale
#define ATTN_PASS s0, s1, s2, s3, biasT, labels
#define ATTN_TAIL out_stride, out_off, Hc, Wc, sy, sx, H, W, H_sp, W_sp, heads, d, scale
extern "C" __global__ void win_attn_f32_32(const float* qkv, float* out, ATTN_ARGS) { win_attn<float, 32>(qkv, ATTN_PASS, out, ATTN_TAIL); }
extern "C" __global__ void win_attn_f32_64(const float* qkv, float* out, ATTN_ARGS) { win_attn<float, 64>(qkv, ATTN_PASS, out, ATTN_TAIL); }
extern "C" __global__ void win_attn_f16_32(const _Float16* qkv, _Float16* out, ATTN_ARGS) { win_attn<_Float16, 32>(qkv, ATTN_PASS, out, ATTN_TAIL); }
extern "C" __global__ void win_attn_f16_64(const _Float16* qkv, _Float16* out, ATTN_ARGS) { win_attn<_Float16, 64>(qkv, ATTN_PASS, out, ATTN_TAIL); }
extern "C" __global__ void win_attn_bf16_32(const bf16_t* qkv, bf16_t* out, ATTN_ARGS) { win_attn<bf16_t, 32>(qkv, ATTN_PASS, out, ATTN_TAIL); }
extern "C" __global__ void win_attn_bf16_64(const bf16_t* qkv, bf16_t* out, ATTN_ARGS) { win_attn<bf16_t, 64>(qkv, ATTN_PASS, out, ATTN_TAIL); }
"""

_SG_SRC = r"""
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

// DAT's SpatialGate, in the token layout x: (B, L=H*W, 2C), rows contiguous.
//   x1, x2 = x[..., :C], x[..., C:]
//   out = x1 * dwconv3x3(LayerNorm(x2) as an image)
// without the two transposes to and from (B, C, H, W).

// Kernel A: LayerNorm statistics of x2, one (mean, rstd) pair per token.
// 8 tokens per 256-thread block, 32 threads per token.
template <typename T>
__device__ void sg_stats(const T* __restrict__ x, int C, long tokens, float eps,
                         float* __restrict__ stats) {
    __shared__ float s1[256], s2[256];
    const int lane = threadIdx.x & 31;
    const long tok = (long)blockIdx.x * 8 + (threadIdx.x >> 5);
    float a = 0.0f, q = 0.0f;
    if (tok < tokens) {
        const T* row = x + tok * (2L * C) + C;
        for (int c = lane; c < C; c += 32) {
            float v = load_val(row, c);
            a += v;
            q += v * v;
        }
    }
    s1[threadIdx.x] = a;
    s2[threadIdx.x] = q;
    __syncthreads();
    for (int o = 16; o > 0; o >>= 1) {
        if (lane < o) {
            s1[threadIdx.x] += s1[threadIdx.x + o];
            s2[threadIdx.x] += s2[threadIdx.x + o];
        }
        __syncthreads();
    }
    if (lane == 0 && tok < tokens) {
        const float mean = s1[threadIdx.x] / C;
        const float var = fmaxf(s2[threadIdx.x] / C - mean * mean, 0.0f);
        stats[tok * 2] = mean;
        stats[tok * 2 + 1] = rsqrtf(var + eps);
    }
}

// Kernel B: normalize x2 on the fly, depthwise 3x3 conv (zero padded), gate.
// Block: 8x8 pixels x 32 channels, 256 threads = 32 channels x 8 columns.
#define SX 8
#define SY 8
#define CC 32
template <typename T>
__device__ void sg_gate(const T* __restrict__ x, const float* __restrict__ stats,
                        const float* __restrict__ gamma, const float* __restrict__ beta,
                        const float* __restrict__ w, const float* __restrict__ bias,
                        T* __restrict__ out, int C, int H, int W) {
    __shared__ float tile[(SY + 2) * (SX + 2) * CC];
    const int chunks = (C + CC - 1) / CC;
    const int b = blockIdx.z / chunks;
    const int c0 = (blockIdx.z % chunks) * CC;
    const int x0 = blockIdx.x * SX, y0 = blockIdx.y * SY;
    const long L = (long)H * W;
    const long C2 = 2L * C;

    for (int i = threadIdx.x; i < (SY + 2) * (SX + 2) * CC; i += 256) {
        const int c = i % CC, p = i / CC;
        const int gy = y0 + p / (SX + 2) - 1, gx = x0 + p % (SX + 2) - 1;
        float v = 0.0f;
        if (gy >= 0 && gy < H && gx >= 0 && gx < W && c0 + c < C) {
            const long tok = (long)b * L + (long)gy * W + gx;
            const float raw = load_val(x, tok * C2 + C + c0 + c);
            v = (raw - stats[tok * 2]) * stats[tok * 2 + 1] * gamma[c0 + c] + beta[c0 + c];
        }
        tile[i] = v;
    }
    __syncthreads();

    const int c = threadIdx.x % CC, tx = threadIdx.x / CC;
    if (c0 + c >= C) return;
    float k[9];
    #pragma unroll
    for (int i = 0; i < 9; i++) k[i] = w[(c0 + c) * 9 + i];
    const float bc = bias ? bias[c0 + c] : 0.0f;
    const int ox = x0 + tx;
    if (ox >= W) return;
    #pragma unroll
    for (int ty = 0; ty < SY; ty++) {
        const int oy = y0 + ty;
        if (oy >= H) break;
        float acc = bc;
        #pragma unroll
        for (int i = 0; i < 3; i++)
            #pragma unroll
            for (int j = 0; j < 3; j++)
                acc += k[i * 3 + j] * tile[((ty + i) * (SX + 2) + tx + j) * CC + c];
        const long tok = (long)b * L + (long)oy * W + ox;
        store_val(out, tok * C + c0 + c, acc * load_val(x, tok * C2 + c0 + c));
    }
}

extern "C" __global__ void sg_stats_f32(const float* x, int C, long tokens, float eps, float* stats) { sg_stats<float>(x, C, tokens, eps, stats); }
extern "C" __global__ void sg_stats_f16(const _Float16* x, int C, long tokens, float eps, float* stats) { sg_stats<_Float16>(x, C, tokens, eps, stats); }
extern "C" __global__ void sg_stats_bf16(const bf16_t* x, int C, long tokens, float eps, float* stats) { sg_stats<bf16_t>(x, C, tokens, eps, stats); }
#define SG_ARGS const float* stats, const float* gamma, const float* beta, const float* w, const float* bias
#define SG_PASS stats, gamma, beta, w, bias
extern "C" __global__ void sg_gate_f32(const float* x, float* out, SG_ARGS, int C, int H, int W) { sg_gate<float>(x, SG_PASS, out, C, H, W); }
extern "C" __global__ void sg_gate_f16(const _Float16* x, _Float16* out, SG_ARGS, int C, int H, int W) { sg_gate<_Float16>(x, SG_PASS, out, C, H, W); }
extern "C" __global__ void sg_gate_bf16(const bf16_t* x, bf16_t* out, SG_ARGS, int C, int H, int W) { sg_gate<bf16_t>(x, SG_PASS, out, C, H, W); }

// Depthwise 3x3 conv (zero padded) in the token layout, with an optional exact
// GELU. Reads channel c of token t at x[t * row_stride + ch_offset + c], so it
// can take e.g. the v part of a (B, L, 3C) qkv buffer directly, and writes a
// contiguous (B, L, C). Same tiling as sg_gate.
template <typename T>
__device__ void dw_tokens(const T* __restrict__ x, long row_stride, int ch_offset,
                          const float* __restrict__ w, const float* __restrict__ bias,
                          int gelu, T* __restrict__ out, int C, int H, int W) {
    __shared__ float tile[(SY + 2) * (SX + 2) * CC];
    const int chunks = (C + CC - 1) / CC;
    const int b = blockIdx.z / chunks;
    const int c0 = (blockIdx.z % chunks) * CC;
    const int x0 = blockIdx.x * SX, y0 = blockIdx.y * SY;
    const long L = (long)H * W;

    for (int i = threadIdx.x; i < (SY + 2) * (SX + 2) * CC; i += 256) {
        const int c = i % CC, p = i / CC;
        const int gy = y0 + p / (SX + 2) - 1, gx = x0 + p % (SX + 2) - 1;
        float v = 0.0f;
        if (gy >= 0 && gy < H && gx >= 0 && gx < W && c0 + c < C) {
            const long tok = (long)b * L + (long)gy * W + gx;
            v = load_val(x, tok * row_stride + ch_offset + c0 + c);
        }
        tile[i] = v;
    }
    __syncthreads();

    const int c = threadIdx.x % CC, tx = threadIdx.x / CC;
    if (c0 + c >= C) return;
    float k[9];
    #pragma unroll
    for (int i = 0; i < 9; i++) k[i] = w[(c0 + c) * 9 + i];
    const float bc = bias ? bias[c0 + c] : 0.0f;
    const int ox = x0 + tx;
    if (ox >= W) return;
    #pragma unroll
    for (int ty = 0; ty < SY; ty++) {
        const int oy = y0 + ty;
        if (oy >= H) break;
        float acc = bc;
        #pragma unroll
        for (int i = 0; i < 3; i++)
            #pragma unroll
            for (int j = 0; j < 3; j++)
                acc += k[i * 3 + j] * tile[((ty + i) * (SX + 2) + tx + j) * CC + c];
        if (gelu) acc = 0.5f * acc * (1.0f + erff(acc * 0.70710678118654752f));
        const long tok = (long)b * L + (long)oy * W + ox;
        store_val(out, tok * C + c0 + c, acc);
    }
}

#define DWT_ARGS long row_stride, int ch_offset, const float* w, const float* bias, int gelu
#define DWT_PASS row_stride, ch_offset, w, bias, gelu
extern "C" __global__ void dw_tokens_f32(const float* x, float* out, DWT_ARGS, int C, int H, int W) { dw_tokens<float>(x, DWT_PASS, out, C, H, W); }
extern "C" __global__ void dw_tokens_f16(const _Float16* x, _Float16* out, DWT_ARGS, int C, int H, int W) { dw_tokens<_Float16>(x, DWT_PASS, out, C, H, W); }
extern "C" __global__ void dw_tokens_bf16(const bf16_t* x, bf16_t* out, DWT_ARGS, int C, int H, int W) { dw_tokens<bf16_t>(x, DWT_PASS, out, C, H, W); }

// LayerNorm over the channels of contiguous (tokens, C) rows, optionally after
// a residual add: sum = x + a (stored, rounded to T like PyTorch's add), out =
// LayerNorm(sum). One wave32 per token, 8 tokens per 256-thread block, up to
// 8 * 32 = 256 channels kept in registers.
__device__ __forceinline__ float round_t(float v, const float*) { return v; }
__device__ __forceinline__ float round_t(float v, const _Float16*) { return (float)(_Float16)v; }
__device__ __forceinline__ float round_t(float v, const bf16_t*) {
    unsigned int u = __float_as_uint(v);
    u += 0x7FFFu + ((u >> 16) & 1u);
    return __uint_as_float(u & 0xFFFF0000u);
}

template <typename T>
__device__ void add_ln(const T* __restrict__ x, const T* __restrict__ a, T* __restrict__ sum_out,
                       T* __restrict__ out, const float* __restrict__ gamma,
                       const float* __restrict__ beta, int C, long tokens, float eps) {
    const int lane = threadIdx.x & 31;
    const long tok = (long)blockIdx.x * 8 + (threadIdx.x >> 5);
    if (tok >= tokens) return;
    const long row = tok * C;
    float v[8];
    float s = 0.0f;
    #pragma unroll
    for (int k = 0; k < 8; k++) {
        const int c = lane + 32 * k;
        float t = 0.0f;
        if (c < C) {
            t = load_val(x, row + c);
            if (a) t = round_t(t + load_val(a, row + c), x);
        }
        v[k] = t;
        s += t;
    }
    #pragma unroll
    for (int o = 16; o > 0; o >>= 1) s += __shfl_xor(s, o, 32);
    const float mean = s / C;
    float q = 0.0f;
    #pragma unroll
    for (int k = 0; k < 8; k++) {
        const int c = lane + 32 * k;
        if (c < C) { const float dv = v[k] - mean; q += dv * dv; }
    }
    #pragma unroll
    for (int o = 16; o > 0; o >>= 1) q += __shfl_xor(q, o, 32);
    const float rstd = rsqrtf(q / C + eps);
    #pragma unroll
    for (int k = 0; k < 8; k++) {
        const int c = lane + 32 * k;
        if (c < C) {
            if (sum_out) store_val(sum_out, row + c, v[k]);
            store_val(out, row + c, (v[k] - mean) * rstd * gamma[c] + beta[c]);
        }
    }
}

#define LN_ARGS const float* gamma, const float* beta, int C, long tokens, float eps
#define LN_PASS gamma, beta, C, tokens, eps
extern "C" __global__ void add_ln_f32(const float* x, const float* a, float* sum_out, float* out, LN_ARGS) { add_ln<float>(x, a, sum_out, out, LN_PASS); }
extern "C" __global__ void add_ln_f16(const _Float16* x, const _Float16* a, _Float16* sum_out, _Float16* out, LN_ARGS) { add_ln<_Float16>(x, a, sum_out, out, LN_PASS); }
extern "C" __global__ void add_ln_bf16(const bf16_t* x, const bf16_t* a, bf16_t* sum_out, bf16_t* out, LN_ARGS) { add_ln<bf16_t>(x, a, sum_out, out, LN_PASS); }
"""

_ATTN_WMMA_SRC = r"""
// DAT window attention on RDNA4 matrix cores (gfx12 WMMA, wave32).
// Same contract as win_attn (see there), for 16-bit inputs.
//
// Block: 256 threads = 8 waves, one (window, head) per block. K and V of the
// window are staged in shared memory (V transposed), each wave walks query
// tiles of 16 rows. Per 16-key tile: S = Q K^T via WMMA (fp32 accumulate),
// scale + bias + shift mask + online softmax in registers, P goes through a
// small per-wave LDS buffer into WMMA operand layout, O += P V via WMMA.
//
// gfx12 wave32 layouts (verified): A lane l -> row l%16, k = 8*(l/16)+i;
// B lane l -> col l%16, k = 8*(l/16)+i; D lane l -> col l%16, row 8*(l/16)+i.

typedef unsigned short u16;
typedef short v8s __attribute__((ext_vector_type(8)));
typedef _Float16 v8h __attribute__((ext_vector_type(8)));
typedef float v8f __attribute__((ext_vector_type(8)));
typedef float v4f __attribute__((ext_vector_type(4)));

__device__ __forceinline__ u16 f2bf(float v) {
    unsigned int u = __float_as_uint(v);
    u += 0x7FFFu + ((u >> 16) & 1u);
    return (u16)(u >> 16);
}
__device__ __forceinline__ u16 f2h(float v) {
    _Float16 h = (_Float16)v;
    return *(u16*)&h;
}
__device__ __forceinline__ float bf2f(u16 v) { return __uint_as_float(((unsigned int)v) << 16); }
__device__ __forceinline__ float h2f(u16 v) { return (float)*(_Float16*)&v; }

template <bool BF16>
__device__ __forceinline__ v8f mma(v8s a, v8s b, v8f c) {
    if constexpr (BF16) {
        return __builtin_amdgcn_wmma_f32_16x16x16_bf16_w32_gfx12(a, b, c);
    } else {
        return __builtin_amdgcn_wmma_f32_16x16x16_f16_w32_gfx12(
            __builtin_bit_cast(v8h, a), __builtin_bit_cast(v8h, b), c);
    }
}

template <bool BF16, int KD>
__device__ void win_attn_wmma(const u16* __restrict__ qkv, long s0, long s1, long s2, long s3,
                              const float* __restrict__ biasT, const int* __restrict__ labels,
                              u16* __restrict__ out, long out_stride, int out_off, int Hc, int Wc,
                              int sy, int sx, int H, int W, int H_sp, int W_sp,
                              int heads, int d, float scale) {
    constexpr int KS = KD / 16;  // k steps over the head dim, and O column tiles
    extern __shared__ unsigned char lds_raw[];
    const int N = H_sp * W_sp;
    u16* Ks = (u16*)lds_raw;           // [N][KD]
    u16* Vt = Ks + N * KD;             // [KD][N]
    u16* Pb = Vt + N * KD;             // [8 waves][16][16]
    int* labs = (int*)(Pb + 8 * 256);  // [N]

    const int nw = W / W_sp, nh = H / H_sp, nW = nh * nw;
    const int h = blockIdx.x % heads;
    const int win = blockIdx.x / heads;
    const int b = win / nW, wimg = win % nW;
    const int ih = wimg / nw, iw = wimg % nw;

    // stage K and V^T (zero padded to KD) and the region labels
    for (int t = threadIdx.x; t < N; t += 256) {
        const int y = ih * H_sp + t / W_sp, x = iw * W_sp + t % W_sp;
        const int ys = (y + sy) % H, xs = (x + sx) % W;
        const bool valid = ys < Hc && xs < Wc;  // window padding is zero
        const long base = (long)b * s1 + ((long)ys * Wc + xs) * s2 + (long)(h * d) * s3;
        for (int j = 0; j < KD; j++) {
            const bool in = j < d && valid;
            Ks[t * KD + j] = in ? qkv[s0 + base + j * s3] : (u16)0;
            Vt[j * N + t] = in ? qkv[2 * s0 + base + j * s3] : (u16)0;
        }
        if (labels) labs[t] = labels[wimg * N + t];
    }
    __syncthreads();

    const int wave = threadIdx.x >> 5, lane = threadIdx.x & 31;
    const int col = lane & 15, half = lane >> 4;
    u16* P = Pb + wave * 256;

    for (int qt = wave; qt < N / 16; qt += 8) {
        // A operands for Q: row = query qt*16 + col, k = s*16 + 8*half + i
        v8s qa[KS];
        {
            const int n = qt * 16 + col;
            const int y = ih * H_sp + n / W_sp, x = iw * W_sp + n % W_sp;
            const int ys = (y + sy) % H, xs = (x + sx) % W;
            const bool valid = ys < Hc && xs < Wc;
            const long base = (long)b * s1 + ((long)ys * Wc + xs) * s2 + (long)(h * d) * s3;
            #pragma unroll
            for (int s = 0; s < KS; s++)
                #pragma unroll
                for (int i = 0; i < 8; i++) {
                    const int j = s * 16 + 8 * half + i;
                    qa[s][i] = (j < d && valid) ? (short)qkv[base + j * s3] : (short)0;
                }
        }
        // this lane's 8 query rows (D layout)
        const int q0 = qt * 16 + 8 * half;
        int qlab[8];
        #pragma unroll
        for (int i = 0; i < 8; i++) qlab[i] = labels ? labs[q0 + i] : 0;

        float m[8], l[8];
        v8f o[KS];
        #pragma unroll
        for (int i = 0; i < 8; i++) { m[i] = -__builtin_inff(); l[i] = 0.0f; }
        #pragma unroll
        for (int t = 0; t < KS; t++) o[t] = (v8f){0, 0, 0, 0, 0, 0, 0, 0};

        for (int kt = 0; kt < N / 16; kt++) {
            const int key = kt * 16 + col;
            v8f sacc = (v8f){0, 0, 0, 0, 0, 0, 0, 0};
            #pragma unroll
            for (int s = 0; s < KS; s++) {
                const v8s kb = *(const v8s*)(Ks + key * KD + s * 16 + 8 * half);
                sacc = mma<BF16>(qa[s], kb, sacc);
            }
            float sv[8];
            const int klab = labels ? labs[key] : 0;
            const float* brow = biasT ? biasT + ((long)h * N + key) * N + q0 : nullptr;
            v4f b0 = {0, 0, 0, 0}, b1 = {0, 0, 0, 0};
            if (brow) { b0 = *(const v4f*)brow; b1 = *(const v4f*)(brow + 4); }
            #pragma unroll
            for (int i = 0; i < 8; i++) {
                float v = sacc[i] * scale + (i < 4 ? b0[i] : b1[i - 4]);
                if (labels && klab != qlab[i]) v -= 100.0f;
                sv[i] = v;
            }
            // row max / sum across the 16 key columns of this half wave
            float corr[8];
            #pragma unroll
            for (int i = 0; i < 8; i++) {
                float mx = sv[i];
                mx = fmaxf(mx, __shfl_xor(mx, 1, 16));
                mx = fmaxf(mx, __shfl_xor(mx, 2, 16));
                mx = fmaxf(mx, __shfl_xor(mx, 4, 16));
                mx = fmaxf(mx, __shfl_xor(mx, 8, 16));
                const float mn = fmaxf(m[i], mx);
                corr[i] = __expf(m[i] - mn);
                const float p = __expf(sv[i] - mn);
                float ps = p;
                ps += __shfl_xor(ps, 1, 16);
                ps += __shfl_xor(ps, 2, 16);
                ps += __shfl_xor(ps, 4, 16);
                ps += __shfl_xor(ps, 8, 16);
                l[i] = l[i] * corr[i] + ps;
                m[i] = mn;
                // P[row][key] for the A-layout re-read below
                P[(8 * half + i) * 16 + col] = BF16 ? f2bf(p) : f2h(p);
            }
            #pragma unroll
            for (int t = 0; t < KS; t++)
                #pragma unroll
                for (int i = 0; i < 8; i++) o[t][i] *= corr[i];
            __builtin_amdgcn_wave_barrier();
            __builtin_amdgcn_fence(__ATOMIC_SEQ_CST, "wavefront");
            // A operand: row = query col, k = key 8*half + i
            const v8s pa = *(const v8s*)(P + col * 16 + 8 * half);
            #pragma unroll
            for (int t = 0; t < KS; t++) {
                // B operand: col = head dim t*16 + col, k = key kt*16 + 8*half + i
                const v8s vb = *(const v8s*)(Vt + (t * 16 + col) * N + kt * 16 + 8 * half);
                o[t] = mma<BF16>(pa, vb, o[t]);
            }
            __builtin_amdgcn_wave_barrier();
            __builtin_amdgcn_fence(__ATOMIC_SEQ_CST, "wavefront");
        }

        // write O / l: lane holds head dim t*16 + col for rows q0 + i
        #pragma unroll
        for (int i = 0; i < 8; i++) {
            const int n = q0 + i;
            const int y = ih * H_sp + n / W_sp, x = iw * W_sp + n % W_sp;
            const int ys = (y + sy) % H, xs = (x + sx) % W;
            if (ys >= Hc || xs >= Wc) continue;
            const float inv = 1.0f / l[i];
            const long ob = (((long)b * Hc + ys) * Wc + xs) * out_stride + out_off + h * d;
            #pragma unroll
            for (int t = 0; t < KS; t++) {
                const int j = t * 16 + col;
                if (j < d) out[ob + j] = BF16 ? f2bf(o[t][i] * inv) : f2h(o[t][i] * inv);
            }
        }
    }
}

#define WMMA_ARGS long s0, long s1, long s2, long s3, const float* biasT, const int* labels, long out_stride, int out_off, int Hc, int Wc, int sy, int sx, int H, int W, int H_sp, int W_sp, int heads, int d, float scale
#define WMMA_PASS s0, s1, s2, s3, biasT, labels, out, out_stride, out_off, Hc, Wc, sy, sx, H, W, H_sp, W_sp, heads, d, scale
extern "C" __global__ void __launch_bounds__(256) win_attn_wmma_bf16_32(const u16* qkv, u16* out, WMMA_ARGS) { win_attn_wmma<true, 32>(qkv, WMMA_PASS); }
extern "C" __global__ void __launch_bounds__(256) win_attn_wmma_bf16_64(const u16* qkv, u16* out, WMMA_ARGS) { win_attn_wmma<true, 64>(qkv, WMMA_PASS); }
extern "C" __global__ void __launch_bounds__(256) win_attn_wmma_bf16_16(const u16* qkv, u16* out, WMMA_ARGS) { win_attn_wmma<true, 16>(qkv, WMMA_PASS); }
extern "C" __global__ void __launch_bounds__(256) win_attn_wmma_f16_32(const u16* qkv, u16* out, WMMA_ARGS) { win_attn_wmma<false, 32>(qkv, WMMA_PASS); }
extern "C" __global__ void __launch_bounds__(256) win_attn_wmma_f16_64(const u16* qkv, u16* out, WMMA_ARGS) { win_attn_wmma<false, 64>(qkv, WMMA_PASS); }
extern "C" __global__ void __launch_bounds__(256) win_attn_wmma_f16_16(const u16* qkv, u16* out, WMMA_ARGS) { win_attn_wmma<false, 16>(qkv, WMMA_PASS); }
"""

_TW, _TH = 32, 16
_MAX_GRID_Z = 65535
_DTYPE_SUFFIX = {torch.float32: "f32", torch.float16: "f16", torch.bfloat16: "bf16"}
# name -> (source, kernel names, extra compiler options)
_PROGRAMS: dict[str, tuple[str, list[str], list[str]]] = {
    "dwconv": (_DWCONV_SRC, [f"dwconv3x3_{s}" for s in _DTYPE_SUFFIX.values()], []),
    "win_attn": (
        _ATTN_SRC,
        [f"win_attn_{s}_{dm}" for s in _DTYPE_SUFFIX.values() for dm in (32, 64)],
        [],
    ),
    # gfx12 (RDNA4) only: uses the gfx12 WMMA builtins
    "win_attn_wmma": (
        _ATTN_WMMA_SRC,
        [f"win_attn_wmma_{s}_{kd}" for s in ("bf16", "f16") for kd in (16, 32, 64)],
        ["-std=c++17"],
    ),
    "spatial_gate": (
        _SG_SRC,
        [f"sg_{k}_{s}" for k in ("stats", "gate") for s in _DTYPE_SUFFIX.values()]
        + [f"dw_tokens_{s}" for s in _DTYPE_SUFFIX.values()]
        + [f"add_ln_{s}" for s in _DTYPE_SUFFIX.values()],
        [],
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
        source, names, extra_opts = _PROGRAMS[program]
        arch = torch.cuda.get_device_properties(device_index).gcnArchName.split(":")[0]
        prog = ctypes.c_void_p()
        self._check(
            self.rtc.hiprtcCreateProgram(
                ctypes.byref(prog), source.encode(), f"{program}.hip".encode(), 0, None, None
            ),
            "hiprtcCreateProgram",
        )
        try:
            opts = [f"--offload-arch={arch}".encode(), b"-O3"] + [o.encode() for o in extra_opts]
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


_gfx12: dict[int, bool] = {}
_wmma_failed = False


def _is_gfx12(device: int) -> bool:
    if device not in _gfx12:
        arch = torch.cuda.get_device_properties(device).gcnArchName
        _gfx12[device] = arch.startswith("gfx12")
    return _gfx12[device]


def _wmma_lds_bytes(n: int, kd: int) -> int:
    # must match win_attn_wmma: K [N][KD], V^T [KD][N], 8 P tiles, labels
    return 2 * n * kd * 2 + 8 * 256 * 2 + n * 4


def _wmma_head_dim(qkv: torch.Tensor, n: int, d: int) -> int:
    """The padded head dim for the WMMA kernel, or 0 if it does not apply."""
    if _wmma_failed or os.environ.get("CHAINNER_HIP_WMMA", "").strip() == "0":
        return 0
    if qkv.dtype not in (torch.bfloat16, torch.float16) or not _is_gfx12(qkv.device.index or 0):
        return 0
    kd = 16 if d <= 16 else 32 if d <= 32 else 64 if d <= 64 else 0
    if not kd or n % 16 or _wmma_lds_bytes(n, kd) > _LDS_LIMIT:
        return 0
    return kd


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
    out: torch.Tensor | None = None,
    out_offset: int = 0,
    shift: tuple[int, int] = (0, 0),
) -> torch.Tensor:
    """
    DAT window attention for one branch, fused into a single kernel.

    qkv: (3, B, Hc*Wc, heads*d), any strides. H and W are the window grid,
        which may be larger than the data (Hc x Wc, from `out`); positions
        outside the data count as zero, like DAT's zero padding.
    bias_t: (heads, N, N) float32, transposed (key, query), contiguous.
    labels: (nW, N) int32 contiguous.
    shift: (sy, sx) for shifted windows: the result equals rolling qkv by
        (-sy, -sx), attending, and rolling the result back by (sy, sx).

    Without `out`, returns (B, H, W, heads*d) like DAT's windows2img. With
    `out` (B, Hc, Wc, Cout) contiguous, writes into channels
    [out_offset, out_offset + heads*d) of it instead, dropping positions
    outside Hc x Wc (the window padding).
    """
    _, B, _L, C = qkv.shape
    d = C // heads
    n = H_sp * W_sp
    if out is None:
        out = torch.empty((B, H, W, C), device=qkv.device, dtype=qkv.dtype)
    _, Hc, Wc, out_c = out.shape  # noqa: N806
    hip = _get_hip()
    device = qkv.device.index or 0
    kd = _wmma_head_dim(qkv, n, d)
    if kd:
        try:
            fn = hip.get(device, "win_attn_wmma", f"win_attn_wmma_{_DTYPE_SUFFIX[qkv.dtype]}_{kd}")
        except Exception as e:  # noqa: BLE001
            # keep the scalar kernel, only the matrix core path is lost
            global _wmma_failed
            _wmma_failed = True
            logger.warning("WMMA attention kernel unavailable, using the scalar one: %s", e)
            kd = 0
    if kd:
        block, shared = 256, _wmma_lds_bytes(n, kd)
    else:
        name = f"win_attn_{_DTYPE_SUFFIX[qkv.dtype]}_{32 if d <= 32 else 64}"
        fn = hip.get(device, "win_attn", name)
        block, shared = n, _attn_lds_bytes(n, d, qkv.dtype)
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
        ctypes.c_int64(out_c),
        ctypes.c_int(out_offset),
        ctypes.c_int(Hc),
        ctypes.c_int(Wc),
        ctypes.c_int(shift[0] % H),
        ctypes.c_int(shift[1] % W),
        ctypes.c_int(H),
        ctypes.c_int(W),
        ctypes.c_int(H_sp),
        ctypes.c_int(W_sp),
        ctypes.c_int(heads),
        ctypes.c_int(d),
        ctypes.c_float(scale),
    ]
    blocks = B * (H // H_sp) * (W // W_sp) * heads
    hip.launch(fn, (blocks, 1, 1), (block, 1, 1), args, _stream(qkv), shared)
    return out


# --- DAT spatial gate ----------------------------------------------------------

_SG_CC, _SG_SX, _SG_SY = 32, 8, 8


def can_spatial_gate(x: torch.Tensor, H: int, W: int) -> bool:  # noqa: N803
    return (
        x.is_cuda
        and x.dim() == 3
        and x.dtype in _DTYPE_SUFFIX
        and not x.requires_grad
        and x.shape[1] == H * W
        and x.shape[2] % 2 == 0
        and x.is_contiguous()
    )


def spatial_gate(
    x: torch.Tensor,
    H: int,  # noqa: N803
    W: int,  # noqa: N803
    gamma: torch.Tensor,
    beta: torch.Tensor,
    eps: float,
    weight: torch.Tensor,
    bias: torch.Tensor | None,
) -> torch.Tensor:
    """
    DAT's SpatialGate: x1 * dwconv3x3(LayerNorm(x2)), in the (B, H*W, 2C) layout.

    gamma/beta: (C,) float32. weight: (C, 9) float32. bias: (C,) float32 or None.
    Returns (B, H*W, C).
    """
    B, L, C2 = x.shape
    C = C2 // 2
    hip = _get_hip()
    device = x.device.index or 0
    sfx = _DTYPE_SUFFIX[x.dtype]
    stream = _stream(x)
    tokens = B * L
    stats = torch.empty((tokens, 2), device=x.device, dtype=torch.float32)
    hip.launch(
        hip.get(device, "spatial_gate", f"sg_stats_{sfx}"),
        ((tokens + 7) // 8, 1, 1),
        (256, 1, 1),
        [
            ctypes.c_void_p(x.data_ptr()),
            ctypes.c_int(C),
            ctypes.c_int64(tokens),
            ctypes.c_float(eps),
            ctypes.c_void_p(stats.data_ptr()),
        ],
        stream,
    )
    out = torch.empty((B, L, C), device=x.device, dtype=x.dtype)
    chunks = (C + _SG_CC - 1) // _SG_CC
    hip.launch(
        hip.get(device, "spatial_gate", f"sg_gate_{sfx}"),
        ((W + _SG_SX - 1) // _SG_SX, (H + _SG_SY - 1) // _SG_SY, B * chunks),
        (256, 1, 1),
        [
            ctypes.c_void_p(x.data_ptr()),
            ctypes.c_void_p(out.data_ptr()),
            ctypes.c_void_p(stats.data_ptr()),
            ctypes.c_void_p(gamma.data_ptr()),
            ctypes.c_void_p(beta.data_ptr()),
            ctypes.c_void_p(weight.data_ptr()),
            ctypes.c_void_p(bias.data_ptr() if bias is not None else 0),
            ctypes.c_int(C),
            ctypes.c_int(H),
            ctypes.c_int(W),
        ],
        stream,
    )
    return out


def dwconv_tokens(
    x: torch.Tensor,
    ch_offset: int,
    channels: int,
    H: int,  # noqa: N803
    W: int,  # noqa: N803
    weight: torch.Tensor,
    bias: torch.Tensor | None,
    gelu: bool,
) -> torch.Tensor:
    """
    Depthwise 3x3 conv on channels [ch_offset, ch_offset + channels) of a
    (B, H*W, row) token tensor with contiguous rows, optionally followed by GELU.

    weight: (channels, 9) float32. bias: (channels,) float32 or None.
    Returns (B, H*W, channels).
    """
    B, L, row = x.shape
    if x.stride(2) != 1 or x.stride(0) != L * x.stride(1):
        raise ValueError("token tensor rows must be contiguous")
    hip = _get_hip()
    out = torch.empty((B, L, channels), device=x.device, dtype=x.dtype)
    chunks = (channels + _SG_CC - 1) // _SG_CC
    hip.launch(
        hip.get(x.device.index or 0, "spatial_gate", f"dw_tokens_{_DTYPE_SUFFIX[x.dtype]}"),
        ((W + _SG_SX - 1) // _SG_SX, (H + _SG_SY - 1) // _SG_SY, B * chunks),
        (256, 1, 1),
        [
            ctypes.c_void_p(x.data_ptr()),
            ctypes.c_void_p(out.data_ptr()),
            ctypes.c_int64(x.stride(1)),
            ctypes.c_int(ch_offset),
            ctypes.c_void_p(weight.data_ptr()),
            ctypes.c_void_p(bias.data_ptr() if bias is not None else 0),
            ctypes.c_int(1 if gelu else 0),
            ctypes.c_int(channels),
            ctypes.c_int(H),
            ctypes.c_int(W),
        ],
        _stream(x),
    )
    return out


# --- LayerNorm (+ residual add) -----------------------------------------------


def can_layer_norm(x: torch.Tensor) -> bool:
    return (
        x.is_cuda
        and x.dtype in _DTYPE_SUFFIX
        and not x.requires_grad
        and x.is_contiguous()
        and 0 < x.shape[-1] <= 256
    )


def layer_norm(
    x: torch.Tensor,
    gamma: torch.Tensor,
    beta: torch.Tensor,
    eps: float,
    residual: torch.Tensor | None = None,
) -> tuple[torch.Tensor | None, torch.Tensor]:
    """
    LayerNorm over the last dim of a contiguous tensor. With `residual`, first
    computes x + residual and returns (that sum, its LayerNorm); otherwise
    (None, LayerNorm(x)). gamma/beta: float32 contiguous.
    """
    C = x.shape[-1]
    tokens = x.numel() // C
    out = torch.empty_like(x)
    sum_out = torch.empty_like(x) if residual is not None else None
    if residual is not None:
        residual = residual.contiguous()
    hip = _get_hip()
    hip.launch(
        hip.get(x.device.index or 0, "spatial_gate", f"add_ln_{_DTYPE_SUFFIX[x.dtype]}"),
        ((tokens + 7) // 8, 1, 1),
        (256, 1, 1),
        [
            ctypes.c_void_p(x.data_ptr()),
            ctypes.c_void_p(residual.data_ptr() if residual is not None else 0),
            ctypes.c_void_p(sum_out.data_ptr() if sum_out is not None else 0),
            ctypes.c_void_p(out.data_ptr()),
            ctypes.c_void_p(gamma.data_ptr()),
            ctypes.c_void_p(beta.data_ptr()),
            ctypes.c_int(C),
            ctypes.c_int64(tokens),
            ctypes.c_float(eps),
        ],
        _stream(x),
    )
    return sum_out, out
