# AO from Height Map — Acceleration Research

## Context

Node: `chainner:image:height_to_ao` ([backend/src/packages/chaiNNer_standard/material_textures/conversion/height_to_ao.py](../backend/src/packages/chaiNNer_standard/material_textures/conversion/height_to_ao.py))

Algorithm: multi-scale HBAO (Horizon-Based Ambient Occlusion). Three radius passes (×2, ×10, ×40 px) blended at 0.5 / 0.3 / 0.2. Each pass casts rays in `num_samples` evenly-spaced directions with 4 sub-steps (20 %, 40 %, 70 %, 100 % of radius).

## Why It Is Slow

The original implementation calls `scipy.ndimage.shift` inside a nested Python loop:

```
num_samples × num_steps × num_passes = 16 × 4 × 3 = 192 scipy calls per execution
```

Each `scipy.ndimage.shift` call:
- Allocates a new full-image array
- Runs bilinear interpolation in Python/C without SIMD batching across calls
- Has non-trivial Python call overhead (GIL acquisition, argument unpacking)

The three passes do run concurrently via `ThreadPoolExecutor`, but each pass itself is still sequential.

## Reference: rayshader `ambient_shade`

The R package rayshader ([reference](https://www.rayshader.com/reference/ambient_shade.html)) uses a simpler algorithm: for each pixel it computes the maximum elevation angle `atan2(Δz, distance)` to all neighbours in N directions. No multi-step sub-sampling — just one lookup per direction per pixel. This is:

- Simpler to vectorize (each direction is a single fixed-offset lookup)
- Naturally expressed as `N` independent shifted-image differences
- Faster per sample but potentially less accurate than HBAO's multi-step horizon

## Options Investigated

### Option 1 — Replace `scipy.ndimage.shift` with `cv2.remap` (implemented)

`cv2.remap` accepts precomputed float32 coordinate maps and uses OpenCV's SIMD-optimized bilinear interpolation. It supports `cv2.BORDER_REFLECT` which matches scipy's `mode="reflect"`.

**Implementation pattern:**
```python
H, W = hmap.shape
row_coords, col_coords = np.meshgrid(
    np.arange(H, dtype=np.float32),
    np.arange(W, dtype=np.float32),
    indexing='ij',
)
# ... inside the angle/step loop:
map_x = col_coords - dx * d   # source x (column) coords
map_y = row_coords - dy * d   # source y (row) coords
offset = cv2.remap(hmap, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
```

**Coordinate convention note:** `cv2.remap(src, map1, map2)` samples `src` at `(map1[y,x], map2[y,x])` — map1 is x (columns), map2 is y (rows). To replicate `scipy.ndimage.shift(hmap, (dy*d, dx*d))` which produces `output[y,x] = input[y - dy*d, x - dx*d]`, the maps are:
- `map_x = col_coords - dx * d`
- `map_y = row_coords - dy * d`

**Expected speedup:** ~3–8× on typical images. No new dependencies — OpenCV is already available throughout `chaiNNer_standard`.

### Option 2 — Batch all angles via `scipy.ndimage.map_coordinates`

Precompute all `(num_samples × num_steps)` coordinate arrays as a single `(N, 2, H*W)` batch and call `map_coordinates` once per pass. Eliminates the Python loop overhead entirely on the CPU side.

**Expected speedup:** ~5–15× CPU.

### Option 3 — PyTorch + CUDA via `torch.nn.functional.grid_sample` (implemented)

`F.grid_sample` supports `padding_mode='reflection'`, runs on CUDA, and can process all N angles as a batch dimension in one kernel call:

```python
# hmap_batch: (N_angles, 1, H, W) — same image replicated N times
# grid:       (N_angles, H, W, 2) — different offset per angle
sampled = F.grid_sample(
    hmap_batch, grid,
    mode='bilinear', padding_mode='reflection', align_corners=True
)
# All N angles sampled in a single GPU dispatch
```

**Architecture note:** `chaiNNer_standard` is intentionally CPU-only (no torch imports found anywhere in the package). The cleanest path for a GPU node would be a dedicated node in `chaiNNer_pytorch` that reuses the same algorithm with a torch backend, using the device-selection pattern already present in `chaiNNer_pytorch/settings.py` (`torch.cuda`, MPS, DirectML fallback chain).

**Expected speedup:** 10–100× with CUDA, depending on GPU and image size.

### Option 4 — Rayshader-style simple horizon angle (future)

Replace HBAO with the simpler `atan2(Δz, distance)` max-elevation-angle method. One lookup per direction rather than 4 sub-steps. Easier to vectorize in both numpy and torch. Trade-off: less accurate HBAO-style gradient weighting, but likely visually acceptable and significantly faster per sample.

## Recommended Future Path

1. **Short-term (done):** cv2.remap swap in the standard package — free speedup.
2. **Medium-term:** Batch all angles per step using numpy broadcasting (Option 2) to eliminate the remaining Python loop.
3. **Long-term:** Add a `chainner:pytorch:height_to_ao` node in `chaiNNer_pytorch` using `F.grid_sample` on GPU (Option 3), following the existing device-selection pattern in that package.
