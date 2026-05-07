from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor

import cv2
import navi
import numpy as np
from nodes.impl.image_utils import create_border
from nodes.impl.upscale.basic_upscale import PaddingType
from nodes.properties.inputs import ImageInput, PaddingTypeInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import Padding

from .. import conversion_group


def _hbao_pass(
    hmap: np.ndarray,
    radius: float,
    num_samples: int,
    falloff_exp: float,
) -> np.ndarray:
    """
    Compute one HBAO pass at a fixed radius, returning a per-pixel occlusion
    value in [0, 1] where 0.0 = fully occluded and 1.0 = fully unoccluded.

    Rays are cast in `num_samples` evenly-spaced angular directions. Each ray
    tests four sub-steps (at 20 %, 40 %, 70 %, 100 % of `radius`) to improve
    horizon detection. The slope at each sample point is attenuated by a
    power-law based on the normalised step distance so that closer geometry
    casts stronger shadows.

    The raw accumulation is normalised against its own maximum value rather
    than against the theoretical maximum. This is necessary because height map
    slopes (height_delta / pixel_distance) are very small for inputs normalised
    to [0, 1], so a fixed denominator would leave the result indistinguishably
    close to white. Per-pass auto-ranging ensures the full [0, 1] output range
    is always used while keeping each scale independent.

    Args:
        hmap: 2-D float32 height map in [0, 1].
        radius: Maximum sample radius in pixels.
        num_samples: Number of evenly-spaced angular ray directions.
        falloff_exp: Exponent for the distance-based attenuation curve.
            Higher values concentrate contribution at the closest steps.

    Returns:
        2-D float32 array in [0, 1] where 1.0 is fully unoccluded.
    """
    H, W = hmap.shape
    ao_accum = np.zeros_like(hmap)
    angles = np.linspace(0, 2 * np.pi, num_samples, endpoint=False)
    steps = [0.2, 0.4, 0.7, 1.0]

    # Base coordinate grids reused for every remap call in this pass.
    # cv2.remap(src, map_x, map_y) samples src at (map_x[y,x], map_y[y,x]),
    # so map_x holds column indices and map_y holds row indices.
    row_base = np.repeat(
        np.arange(H, dtype=np.float32).reshape(H, 1), W, axis=1
    )
    col_base = np.repeat(
        np.arange(W, dtype=np.float32).reshape(1, W), H, axis=0
    )

    for angle in angles:
        dx, dy = float(np.cos(angle)), float(np.sin(angle))
        for s in steps:
            d = radius * s
            # Replicate scipy.ndimage.shift(hmap, (dy*d, dx*d), mode="reflect"):
            # output[y,x] = input[y - dy*d, x - dx*d]
            map_x = col_base - dx * d
            map_y = row_base - dy * d
            offset = cv2.remap(
                hmap, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT
            )

            diff = offset - hmap

            # Upward slope only — a lower neighbour cannot occlude the sky
            slope = np.maximum(0.0, diff) / (d + 1e-3)

            # Contribution decays as the step fraction approaches 1.0
            attenuation = (1.0 - s) ** falloff_exp

            ao_accum += slope * attenuation

    # Average over samples and steps to get a per-pixel mean slope
    ao_accum /= num_samples * len(steps)

    # Auto-range: the absolute slope values for a [0, 1] normalised height map
    # are very small (typically 0.001-0.05), so normalising by a fixed constant
    # produces values indistinguishably close to 1 (white). Instead we scale by
    # the actual image maximum so the pass always spans the full [0, 1] range.
    ao_max = float(ao_accum.max())
    if ao_max < 1e-10:
        # Completely flat input — no occlusion possible
        return np.ones_like(hmap)

    occlusion = ao_accum / ao_max  # [0, 1]: 1 = most occluded area in pass
    return 1.0 - occlusion         # invert: 1 = unoccluded, 0 = most occluded


def height_to_ao(
    hmap: np.ndarray,
    strength: float,
    radius_scale: float,
    num_samples: int,
    falloff: float,
) -> np.ndarray:
    """
    Generate a multi-scale AO map from a 2-D height map.

    Three passes run at fine (x2 px), medium (x10 px), and coarse (x40 px)
    radii scaled by `radius_scale`. Each pass is auto-ranged to [0, 1]
    independently so that detail at every scale contributes meaningfully.
    The passes are blended as a weighted average and then `strength` is
    applied as a linear contrast stretch: it scales how dark the occluded
    regions become while leaving fully unoccluded (value = 1.0) areas intact.

    Args:
        hmap: 2-D float32 height map in [0, 1].
        strength: AO contrast multiplier. 1.0 uses the full auto-ranged output;
            values > 1 deepen shadows (clipping to black at >1/strength);
            values < 1 lighten the effect towards grey.
        radius_scale: Uniform scale factor applied to all three radii.
        num_samples: Number of angular ray directions per pass.
        falloff: Exponent for per-sample distance attenuation.

    Returns:
        2-D float32 AO map in [0, 1].
    """
    # Three spatial scales and their additive blend weights (must sum to 1)
    radii = [2.0 * radius_scale, 10.0 * radius_scale, 40.0 * radius_scale]
    weights = [0.5, 0.3, 0.2]

    # Run all three passes concurrently. scipy and numpy release the GIL during
    # their C-level operations, so threads achieve true parallelism here and the
    # wall-clock time is roughly that of the single slowest (coarsest) pass.
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [
            executor.submit(_hbao_pass, hmap, radius, num_samples, falloff)
            for radius in radii
        ]
        pass_results = [f.result() for f in futures]

    # Weighted average of independently auto-ranged passes
    combined = sum(
        weight * pass_ao
        for weight, pass_ao in zip(weights, pass_results, strict=True)
    )

    # Apply strength as a linear contrast stretch anchored at 1.0 (unoccluded).
    # (1 - combined) is the raw occlusion amount; scaling it by strength and
    # clipping to [0, 1] deepens shadows without touching fully-lit areas.
    ao = 1.0 - np.clip((1.0 - combined) * strength, 0.0, 1.0)
    return ao


@conversion_group.register(
    schema_id="chainner:image:height_to_ao",
    name="Height Map to AO",
    description=[
        "Generate an ambient occlusion (AO) map from a height map using a multi-scale horizon-based approach (HBAO).",
        "Three radius passes — fine (×2 px), medium (×10 px), and coarse (×40 px) — are blended as a weighted average so that both fine surface details and broad concavities contribute to the final result. All radii are scaled by the **Radius Scale** parameter.",
        "### Seamless Tiling",
        "Set **Padding** to *Wrap (Tile)* when baking AO for a tiling texture. The node pads the image by the coarsest ray radius on all sides before processing and crops back afterwards, so rays at the image boundary wrap correctly instead of reflecting into empty space.",
        "### Algorithm",
        "For each pixel, rays are cast in **Samples** evenly-spaced directions. Along each ray, four sub-steps measure how much the surrounding height surface rises above the current pixel. Higher and closer elevations produce stronger occlusion. Each pass is normalised to its own data range so that detail at every spatial scale is always visible, regardless of how subtle the absolute height differences are.",
        "### Parameters",
        "**Strength** is a linear contrast control anchored at white (unoccluded). At 1.0 the result uses the full auto-ranged output. Values above 1.0 deepen shadows, clipping the darkest areas to black. Values below 1.0 lighten the effect towards grey.",
        "**Radius Scale** uniformly scales all three sample radii. Increase for broader, softer shadows; decrease for tight, fine-detail occlusion.",
        "**Samples** sets the number of ray directions. More samples produce smoother results at the cost of longer processing times.",
        "**Falloff** controls how quickly each sample's shadow contribution decays with distance. Higher values concentrate occlusion close to the occluding geometry.",
    ],
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput("Height Map", channels=1),
        PaddingTypeInput().with_docs(
            "Pads the image before processing to prevent boundary artifacts.",
            "Use **Wrap (Tile)** for tiling textures — rays that extend beyond the image edge will wrap around correctly.",
            "Use **Reflect (Mirror)** or **Replicate Edges** for non-tiling textures to avoid hard boundary seams.",
            hint=True,
        ),
        SliderInput(
            "Strength",
            min=0,
            max=5,
            default=1,
            precision=2,
            slider_step=0.1,
            step=0.5,
        ).with_docs(
            "Linear contrast multiplier for the AO effect. "
            "At 1.0 the auto-ranged result is used as-is. "
            "Increase to deepen shadows; decrease for a subtler effect.",
            hint=True,
        ),
        SliderInput(
            "Radius Scale",
            min=0.1,
            max=5,
            default=1,
            precision=2,
            slider_step=0.1,
            step=0.5,
        ).with_docs(
            "Uniformly scales all three sample radii (fine: ×2 px, medium: ×10 px, coarse: ×40 px). "
            "Increase for softer, wider shadows across larger features; "
            "decrease for tighter occlusion limited to fine surface details.",
            hint=True,
        ),
        SliderInput(
            "Samples",
            min=8,
            max=64,
            default=16,
            precision=0,
            slider_step=1,
            step=4,
        ).with_docs(
            "Number of angular ray directions sampled per pixel per pass. "
            "More samples reduce banding and produce smoother results, "
            "but each doubling roughly doubles processing time.",
            hint=True,
        ),
        SliderInput(
            "Falloff",
            min=0.1,
            max=3,
            default=1.5,
            precision=2,
            slider_step=0.1,
            step=0.5,
        ).with_docs(
            "Exponent controlling how quickly shadow contribution decays along each ray. "
            "Higher values concentrate occlusion near the occluding surface edges; "
            "lower values spread the shadow more evenly across the sampled distance.",
            hint=True,
        ),
    ],
    outputs=[
        ImageOutput(
            "AO Map",
            size_as=0,
            image_type=navi.Image(channels=1),
        ),
    ],
)
def height_to_ao_node(
    img: np.ndarray,
    padding: PaddingType,
    strength: float,
    radius_scale: float,
    samples: float,
    falloff: float,
) -> np.ndarray:
    # Pad by the coarsest ray radius so boundary rays don't hit the image edge.
    pad_size = math.ceil(40.0 * radius_scale)
    if padding != PaddingType.NONE:
        img = create_border(img, padding.to_border_type(), Padding.all(pad_size))

    hmap = img.squeeze().astype(np.float32)
    ao = height_to_ao(hmap, strength, radius_scale, int(samples), falloff)

    if padding != PaddingType.NONE:
        ao = ao[pad_size:-pad_size, pad_size:-pad_size]

    return ao
