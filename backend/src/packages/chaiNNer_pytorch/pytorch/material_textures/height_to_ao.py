from __future__ import annotations

import gc
import math

import numpy as np
import torch
import torch.nn.functional as F  # noqa: N812

import navi
from api import NodeContext
from nodes.groups import if_enum_group
from nodes.impl.image_utils import create_border
from nodes.impl.pytorch.utils import safe_cuda_cache_empty
from nodes.impl.upscale.auto_split import Split, auto_split
from nodes.impl.upscale.auto_split_tiles import (
    CUSTOM,
    TILE_SIZE_256,
    TileSize,
    parse_tile_size_input,
)
from nodes.impl.upscale.basic_upscale import PaddingType
from nodes.impl.upscale.tiler import MaxTileSize
from nodes.properties.inputs import (
    ImageInput,
    NumberInput,
    PaddingTypeInput,
    SliderInput,
    TileSizeDropdown,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import Padding, Region

from ...settings import get_settings
from .. import material_textures_group

# Base radii (px) of the fine, medium and coarse passes and their blend weights.
_RADII = (2.0, 10.0, 40.0)
_WEIGHTS = (0.5, 0.3, 0.2)
# Sub-steps along each ray as fractions of the radius. Attenuation is
# (1 - step) ** falloff, so the contribution fades to zero at the full radius;
# a step at 1.0 would always have zero weight and is therefore omitted.
_STEPS = (0.2, 0.4, 0.7)
# Directions sampled per grid_sample call. Bounds peak memory to
# O(_DIRECTION_CHUNK * len(_STEPS) * H * W) regardless of the Samples setting.
_DIRECTION_CHUNK = 8


def _occlusion_pass(
    hmap: torch.Tensor,
    radius: float,
    height_scale: float,
    num_samples: int,
    falloff_exp: float,
    device: torch.device,
) -> torch.Tensor:
    """
    Horizon-based occlusion of one pass.

    For each direction, the heights at the `_STEPS` sub-steps are turned into
    elevation angles (height difference * `height_scale` / distance). Every
    time a sub-step raises the horizon above the highest angle seen so far
    along that ray (starting at the flat horizon), the increase in
    sin(elevation) is added, weighted by (1 - step) ** falloff_exp. The result
    is averaged over directions.

    The value depends only on each pixel's neighbourhood, so tiles and crops
    produce the same result as the whole image.

    Args:
        hmap: (1, 1, H, W) float32 tensor in [0, 1].
        radius: Distance in pixels at which a sample's contribution reaches 0.
        height_scale: Height in pixels of a height map value of 1.0.
        num_samples: Number of evenly-spaced angular directions.
        falloff_exp: Distance-attenuation exponent.

    Returns:
        (H, W) float32 tensor in [0, 1], 0 = unoccluded, 1 = fully occluded.
    """
    h, w = hmap.shape[-2:]
    hmap_2d = hmap[0, 0]
    num_steps = len(_STEPS)

    steps = torch.tensor(_STEPS, device=device)
    distances = radius * steps  # (S,)
    attenuation = ((1.0 - steps) ** falloff_exp).view(1, num_steps, 1, 1)

    angles = torch.linspace(0, 2 * math.pi, num_samples + 1, device=device)[
        :num_samples
    ]

    # Pixel centres in normalised coordinates for align_corners=False. With that
    # setting, padding_mode="reflection" mirrors about the image border, which
    # matches cv2.BORDER_REFLECT used by the CPU node.
    base_x = ((torch.arange(w, device=device) * 2 + 1) / w - 1).view(1, 1, w)
    base_y = ((torch.arange(h, device=device) * 2 + 1) / h - 1).view(1, h, 1)

    accum = torch.zeros(h, w, device=device)
    for start in range(0, num_samples, _DIRECTION_CHUNK):
        chunk = angles[start : start + _DIRECTION_CHUNK]
        n = len(chunk)
        # Pixel offsets per (direction, step), flattened direction-major.
        # output[y, x] = input[y - dy*d, x - dx*d]
        off_x = -(torch.cos(chunk)[:, None] * distances[None, :]).reshape(-1)
        off_y = -(torch.sin(chunk)[:, None] * distances[None, :]).reshape(-1)
        k = off_x.numel()

        grid = torch.stack(
            [
                (base_x + off_x.view(k, 1, 1) * (2.0 / w)).expand(k, h, w),
                (base_y + off_y.view(k, 1, 1) * (2.0 / h)).expand(k, h, w),
            ],
            dim=-1,
        )  # (k, H, W, 2)
        sampled = F.grid_sample(
            hmap.expand(k, -1, -1, -1),
            grid,
            mode="bilinear",
            padding_mode="reflection",
            align_corners=False,
        ).view(n, num_steps, h, w)

        # Elevation of each sample above the current pixel, as sin(angle).
        tan = (sampled - hmap_2d) * height_scale / distances.view(1, num_steps, 1, 1)
        sin = tan * torch.rsqrt(1.0 + tan * tan)

        # Horizon before each step: highest elevation seen so far, starting at 0.
        horizon = torch.cummax(sin, dim=1).values.clamp(min=0.0)
        prev_horizon = torch.cat(
            [torch.zeros_like(horizon[:, :1]), horizon[:, :-1]], dim=1
        )
        gain = torch.clamp(sin - prev_horizon, min=0.0) * attenuation
        accum += gain.sum(dim=(0, 1))

    return accum / num_samples


def _height_to_ao(
    hmap: torch.Tensor,
    height_scale: float,
    strength: float,
    radius_scale: float,
    num_samples: int,
    falloff: float,
    device: torch.device,
) -> torch.Tensor:
    """(H, W) AO map in [0, 1], 1 = unoccluded."""
    occlusion = sum(
        weight
        * _occlusion_pass(
            hmap, r * radius_scale, height_scale, num_samples, falloff, device
        )
        for weight, r in zip(_WEIGHTS, _RADII, strict=True)
    )
    return 1.0 - torch.clamp(occlusion * strength, 0.0, 1.0)


def _as_2d(img: np.ndarray) -> np.ndarray:
    return img[:, :, 0] if img.ndim == 3 else img


@material_textures_group.register(
    schema_id="chainner:pytorch:height_to_ao",
    name="Height Map to AO (GPU)",
    description=[
        "Generate an ambient occlusion (AO) map from a height map using a GPU-accelerated multi-scale horizon-based algorithm (HBAO).",
        "Equivalent to the **Height Map to AO** node in the Standard package, but sample directions are processed as batched GPU operations. Falls back to CPU PyTorch when no GPU is available.",
        "### Seamless Tiling",
        "Set **Padding** to *Wrap (Tile)* when baking AO for a tiling texture. The node pads the image by the coarsest ray radius on all sides before processing and crops back afterwards, so rays at the image boundary wrap correctly instead of reflecting.",
        "### Tiling / VRAM",
        "**Tile Size** splits the image into overlapping chunks to keep VRAM usage bounded. Each chunk includes a border equal to the coarsest ray radius, so tiling gives the same result as processing the whole image. *Auto* starts at 1024 px and automatically halves on out-of-memory. *No Tiling* processes the whole image at once and fails with an error if there is not enough memory.",
        "### Algorithm",
        "Three radius passes — fine (2 px), medium (10 px), coarse (40 px), each multiplied by **Radius Scale** — are blended at 0.5 / 0.3 / 0.2. Within each pass, every **Samples** direction is sampled at 20%, 40% and 70% of the radius. Each sample's height difference is converted to an elevation angle using **Height Scale**, and occlusion grows as the horizon rises along the ray. Contributions fade to zero at the full radius.",
        "### Parameters",
        "**Height Scale** sets how tall the surface is: the height in pixels of a white (1.0) height map value. This is the main control for how strong the AO is.",
        "**Strength** multiplies the computed occlusion. Values above 1.0 deepen shadows; values below 1.0 lighten them.",
        "**Radius Scale** uniformly scales all three radii. Increase for broader shadows across large features; decrease for tight detail occlusion.",
        "**Samples** sets the number of ray directions. More samples reduce banding at the cost of processing time.",
        "**Falloff** controls how quickly shadow contribution decays along each ray. Higher values concentrate occlusion near occluding edges.",
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
        TileSizeDropdown(estimate=True).with_docs(
            "Splits the image into overlapping tiles to keep VRAM usage bounded.",
            "Each tile includes a border equal to the coarsest ray radius so rays do not cross tile boundaries.",
            "*Auto* starts at 1024 px and automatically halves on out-of-memory errors.",
            "*No Tiling* processes the whole image at once — fastest when it fits in VRAM.",
            hint=True,
        ),
        if_enum_group(2, CUSTOM)(
            NumberInput(
                "Custom Tile Size",
                min=1,
                max=None,
                default=TILE_SIZE_256,
                unit="px",
            ),
        ),
        SliderInput(
            "Height Scale",
            min=1,
            max=500,
            default=20,
            precision=1,
            unit="px",
            scale="log",
        ).with_docs(
            "How tall the surface is: the height in pixels of a white (1.0) value in the height map. "
            "Higher values make bumps steeper and the AO darker; lower values make the surface flatter.",
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
            "Multiplier for the computed occlusion. "
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
            "Directions are processed in batches on the GPU, so doubling samples "
            "costs far less than doubling on the CPU version.",
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
    node_context=True,
)
def height_to_ao_node(
    context: NodeContext,
    img: np.ndarray,
    padding: PaddingType,
    tile_size: TileSize,
    custom_tile_size: int,
    height_scale: float,
    strength: float,
    radius_scale: float,
    samples: float,
    falloff: float,
) -> np.ndarray:
    exec_options = get_settings(context)
    context.add_cleanup(
        safe_cuda_cache_empty,
        after="node" if exec_options.force_cache_wipe else "chain",
    )
    device = exec_options.device
    num_samples = int(samples)

    # Pad by the coarsest ray radius so boundary rays don't hit the image edge.
    # This also serves as the overlap for tiled processing (same distance).
    pad_size = math.ceil(max(_RADII) * radius_scale)
    if padding != PaddingType.NONE:
        img = create_border(img, padding.to_border_type(), Padding.all(pad_size))

    if tile_size == CUSTOM:
        tiler = MaxTileSize(custom_tile_size)
    else:
        tiler = parse_tile_size_input(tile_size, lambda: MaxTileSize(1024))

    def process_tile(tile_np: np.ndarray, _region: Region) -> np.ndarray | Split:
        try:
            tile_2d = _as_2d(tile_np).astype(np.float32)
            tensor = torch.from_numpy(tile_2d)[None, None].to(device)
            ao = _height_to_ao(
                tensor,
                height_scale,
                strength,
                radius_scale,
                num_samples,
                falloff,
                device,
            )
            return ao.detach().cpu().numpy()[:, :, np.newaxis]  # (H, W, 1)
        except RuntimeError as e:
            # Same OOM detection as nodes/impl/pytorch/auto_split.py; also covers
            # CPU ("can't allocate memory") and torch.cuda.OutOfMemoryError.
            if "allocate" in str(e) or "CUDA" in str(e):
                gc.collect()
                safe_cuda_cache_empty()
                return Split()
            raise

    ao = _as_2d(auto_split(img, process_tile, tiler, overlap=pad_size))

    if padding != PaddingType.NONE:
        ao = ao[pad_size:-pad_size, pad_size:-pad_size]

    return ao
