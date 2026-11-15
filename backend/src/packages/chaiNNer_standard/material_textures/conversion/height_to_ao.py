from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np

import navi
from nodes.impl.ambient_occlusion import AO_RADII, AO_STEPS, combine_ao_passes
from nodes.impl.image_utils import create_border
from nodes.impl.upscale.basic_upscale import PaddingType
from nodes.properties.inputs import (
    BoolInput,
    ImageInput,
    PaddingTypeInput,
    SliderInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import Padding

from .. import conversion_group


def _occlusion_pass(
    hmap: np.ndarray,
    radius: float,
    height_scale: float,
    num_samples: int,
    falloff_exp: float,
) -> np.ndarray:
    """
    Horizon-based occlusion of one pass.

    Rays are cast in `num_samples` evenly-spaced directions. Along each ray,
    the heights at the `AO_STEPS` sub-steps are turned into elevation angles
    (height difference * `height_scale` / distance). Every time a sub-step
    raises the horizon above the highest angle seen so far along that ray
    (starting at the flat horizon), the increase in sin(elevation) is added,
    weighted by (1 - step) ** falloff_exp. The result is averaged over
    directions.

    The value depends only on each pixel's neighbourhood, so crops and tiles
    of an image produce the same result as the whole image.

    Args:
        hmap: 2-D float32 height map in [0, 1].
        radius: Distance in pixels at which a sample's contribution reaches 0.
        height_scale: Height in pixels of a height map value of 1.0.
        num_samples: Number of evenly-spaced angular ray directions.
        falloff_exp: Exponent for the distance-based attenuation curve.
            Higher values concentrate contribution at the closest steps.

    Returns:
        2-D float32 array in [0, 1], 0 = unoccluded, 1 = fully occluded.
    """
    h, w = hmap.shape
    accum = np.zeros_like(hmap)
    angles = np.linspace(0, 2 * np.pi, num_samples, endpoint=False)

    # Base coordinate grids reused for every remap call in this pass.
    # cv2.remap(src, map_x, map_y) samples src at (map_x[y,x], map_y[y,x]),
    # so map_x holds column indices and map_y holds row indices.
    row_base = np.repeat(np.arange(h, dtype=np.float32).reshape(h, 1), w, axis=1)
    col_base = np.repeat(np.arange(w, dtype=np.float32).reshape(1, w), h, axis=0)

    for angle in angles:
        dx, dy = float(np.cos(angle)), float(np.sin(angle))
        # sin of the highest elevation seen so far along this ray
        horizon = np.zeros_like(hmap)
        for s in AO_STEPS:
            d = radius * s
            # Shift hmap by (dy*d, dx*d) with mirrored borders:
            # output[y,x] = input[y - dy*d, x - dx*d]
            map_x = col_base - dx * d
            map_y = row_base - dy * d
            sample = cv2.remap(
                hmap, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT
            )

            # Elevation of the sample above the current pixel, as sin(angle)
            tan = (sample - hmap) * (height_scale / d)
            sin = tan / np.sqrt(1.0 + tan * tan)

            # Only a sample above the current horizon adds occlusion
            gain = np.maximum(sin - horizon, 0.0)
            accum += gain * ((1.0 - s) ** falloff_exp)
            horizon = np.maximum(horizon, sin)

    return accum / num_samples


def _raw_occlusion(
    hmap: np.ndarray,
    height_scale: float,
    radius_scale: float,
    num_samples: int,
    falloff: float,
) -> np.ndarray:
    """
    Raw occlusion of the fine (2 px), medium (10 px) and coarse (40 px) passes,
    with radii scaled by `radius_scale`.

    Returns:
        (H, W, 3) float32 array, one channel per pass, 0 = unoccluded.
    """
    # Run all three passes concurrently. cv2.remap and NumPy's array operations
    # release the GIL, so the passes overlap instead of running back to back.
    with ThreadPoolExecutor(max_workers=len(AO_RADII)) as executor:
        futures = [
            executor.submit(
                _occlusion_pass,
                hmap,
                r * radius_scale,
                height_scale,
                num_samples,
                falloff,
            )
            for r in AO_RADII
        ]
        return np.stack([f.result() for f in futures], axis=-1)


@conversion_group.register(
    schema_id="chainner:image:height_to_ao",
    name="Height Map to AO",
    description=[
        "Generate an ambient occlusion (AO) map from a height map using a multi-scale horizon-based approach (HBAO).",
        "Three radius passes — fine (2 px), medium (10 px), and coarse (40 px) — are blended as a weighted average so that both fine surface details and broad concavities contribute to the final result. All radii are scaled by the **Radius Scale** parameter.",
        "### Seamless Tiling",
        "Set **Padding** to *Wrap (Tile)* when baking AO for a tiling texture. The node pads the image by the coarsest ray radius on all sides before processing and crops back afterwards, so rays at the image boundary wrap correctly instead of reflecting into empty space.",
        "### Algorithm",
        "For each pixel, rays are cast in **Samples** evenly-spaced directions. Along each ray, three sub-steps (at 20%, 40% and 70% of the radius) convert the surrounding height into an elevation angle using **Height Scale**. Occlusion grows each time the horizon rises along the ray, and contributions fade to zero at the full radius.",
        "### Parameters",
        "**Auto Level** (on by default) scales each pass so the most occluded area of the image is fully dark, giving a consistent look across textures with very different height ranges. Turn it off to use the occlusion exactly as computed from **Height Scale**; the result then depends only on each pixel's surroundings, so crops of a texture match the full texture.",
        "**Height Scale** sets how tall the surface is: the height in pixels of a white (1.0) height map value. With **Auto Level** off it is the main control for how strong the AO is; with it on it shapes the contrast, with higher values flattening the shading.",
        "**Strength** multiplies the occlusion. Values above 1.0 deepen shadows, clipping the darkest areas to black. Values below 1.0 lighten them.",
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
        BoolInput("Auto Level", default=True).with_docs(
            "Scale the AO so the most occluded area of the image is fully dark. "
            "Gives a consistent look across textures without tuning. "
            "Turn off to use the occlusion exactly as computed from **Height Scale**.",
            hint=True,
        ),
        SliderInput(
            "Height Scale",
            min=1,
            max=500,
            default=16,
            precision=1,
            unit="px",
            scale="log",
        ).with_docs(
            "How tall the surface is: the height in pixels of a white (1.0) value in the height map. "
            "Higher values make bumps steeper. With **Auto Level** off this sets how dark the AO is; "
            "with it on, higher values flatten the shading.",
            hint=True,
        ),
        SliderInput(
            "Strength",
            min=0,
            max=10,
            default=1,
            precision=2,
            slider_step=0.1,
            step=0.5,
        ).with_docs(
            "Multiplier for the occlusion. "
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
            "Uniformly scales all three sample radii (fine: 2 px, medium: 10 px, coarse: 40 px). "
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
    auto_level: bool,
    height_scale: float,
    strength: float,
    radius_scale: float,
    samples: float,
    falloff: float,
) -> np.ndarray:
    # Pad by the coarsest ray radius so boundary rays don't hit the image edge.
    pad_size = math.ceil(max(AO_RADII) * radius_scale)
    if padding != PaddingType.NONE:
        img = create_border(img, padding.to_border_type(), Padding.all(pad_size))

    hmap = (img[:, :, 0] if img.ndim == 3 else img).astype(np.float32)
    passes = _raw_occlusion(hmap, height_scale, radius_scale, int(samples), falloff)

    if padding != PaddingType.NONE:
        passes = passes[pad_size:-pad_size, pad_size:-pad_size]

    return combine_ao_passes(passes, auto_level, strength)
