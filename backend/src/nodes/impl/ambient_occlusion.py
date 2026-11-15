"""
Shared pieces of the Height Map to AO nodes (Standard and PyTorch).

Both nodes compute one raw occlusion map per radius pass and then call
`combine_ao_passes` once on the full image, which keeps tiled processing
identical to processing the whole image at once.
"""

from __future__ import annotations

import numpy as np

# Base radii (px) of the fine, medium and coarse passes and their blend weights.
AO_RADII = (2.0, 10.0, 40.0)
AO_WEIGHTS = (0.5, 0.3, 0.2)
# Sub-steps along each ray as fractions of the radius. Attenuation is
# (1 - step) ** falloff, so the contribution fades to zero at the full radius;
# a step at 1.0 would always have zero weight and is therefore omitted.
AO_STEPS = (0.2, 0.4, 0.7)

# Smallest pass maximum that Auto Level will stretch to full occlusion.
_MIN_LEVEL = 1e-4


def combine_ao_passes(
    passes: np.ndarray, auto_level: bool, strength: float
) -> np.ndarray:
    """
    Blend the raw per-pass occlusion into the final AO map.

    Args:
        passes: (H, W, len(AO_RADII)) raw occlusion in [0, 1], one channel per
            pass, 0 = unoccluded.
        auto_level: If True, scale each pass so its most occluded pixel in the
            whole image reaches full occlusion. This gives a consistent look
            across textures with very different height ranges, at the cost of
            the result depending on the whole image. If False, the occlusion
            is used as computed from Height Scale.
        strength: Multiplier applied to the blended occlusion.

    Returns:
        (H, W) float32 AO map in [0, 1], 1 = unoccluded.
    """
    occlusion = np.zeros(passes.shape[:2], dtype=np.float32)
    for i, weight in enumerate(AO_WEIGHTS):
        p = passes[:, :, i]
        if auto_level:
            p_max = float(p.max())
            # Below this the pass has no real occlusion, only float rounding
            # noise from the bilinear sampling (about 1e-8 for a flat input),
            # which levelling would otherwise stretch to full black.
            p = p / p_max if p_max > _MIN_LEVEL else np.zeros_like(p)
        occlusion += weight * p

    return 1.0 - np.clip(occlusion * strength, 0.0, 1.0)
