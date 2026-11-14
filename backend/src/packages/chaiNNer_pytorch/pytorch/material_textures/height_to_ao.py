from __future__ import annotations

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
    NO_TILING,
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


def _hbao_pass(
    hmap: torch.Tensor,
    radius: float,
    num_samples: int,
    falloff_exp: float,
    device: torch.device,
) -> torch.Tensor:
    """
    GPU-vectorized HBAO pass. All num_samples * 4 sub-steps are dispatched
    as a single batched F.grid_sample call, so the GPU processes every
    direction and distance simultaneously.

    Args:
        hmap: (1, 1, H, W) float32 tensor in [0, 1].
        radius: Maximum sample radius in pixels.
        num_samples: Number of evenly-spaced angular directions.
        falloff_exp: Distance-attenuation exponent.

    Returns:
        (H, W) float32 tensor in [0, 1] where 1.0 = fully unoccluded.
    """
    # Shape comments below use N = num_samples, S = num_steps, (H, W) = (h, w).
    h, w = hmap.shape[-2:]
    num_steps = 4
    n = num_samples
    total = n * num_steps

    steps = torch.tensor([0.2, 0.4, 0.7, 1.0], device=device)  # (S,)
    attenuations = (1.0 - steps) ** falloff_exp  # (S,)
    distances = radius * steps  # (S,)

    angles = torch.linspace(0, 2 * math.pi, n + 1, device=device)[:n]
    dx = torch.cos(angles)  # (N,)
    dy = torch.sin(angles)  # (N,)

    # Per-(angle, step) shifts in normalised [-1, 1] coords (align_corners=True).
    # A pixel shift of -d maps to a normalised shift of -2*d/(dim-1).
    # The sign matches scipy/cv2: output[y,x] = input[y - dy*d, x - dx*d].
    shift_x = -(dx[:, None] * distances[None, :]) * (2.0 / max(w - 1, 1))  # (N, S)
    shift_y = -(dy[:, None] * distances[None, :]) * (2.0 / max(h - 1, 1))  # (N, S)
    shift_x = shift_x.reshape(total)  # (N*S,)
    shift_y = shift_y.reshape(total)  # (N*S,)

    # Base coordinate grid in [-1, 1]: shape (H, W)
    base_x = torch.linspace(-1, 1, w, device=device).unsqueeze(0).expand(h, w)
    base_y = torch.linspace(-1, 1, h, device=device).unsqueeze(1).expand(h, w)

    # Broadcast shifts onto the grid: (N*S, H, W)
    grid_x = base_x.unsqueeze(0) + shift_x[:, None, None]
    grid_y = base_y.unsqueeze(0) + shift_y[:, None, None]
    grid = torch.stack([grid_x, grid_y], dim=-1)  # (N*S, H, W, 2)

    # Single GPU dispatch: sample all N*S offsets at once
    hmap_batch = hmap.expand(total, -1, -1, -1)  # (N*S, 1, H, W) — no copy
    sampled = F.grid_sample(
        hmap_batch,
        grid,
        mode="bilinear",
        padding_mode="reflection",
        align_corners=True,
    ).squeeze(1)  # (N*S, H, W)

    hmap_2d = hmap.squeeze()  # (H, W)
    diff = sampled - hmap_2d.unsqueeze(0)  # (N*S, H, W)

    # Upward slope only; attenuate by step distance
    dist_flat = distances.unsqueeze(0).expand(n, num_steps).reshape(total)  # (N*S,)
    att_flat = attenuations.unsqueeze(0).expand(n, num_steps).reshape(total)  # (N*S,)

    slope = torch.clamp(diff, min=0.0) / (dist_flat[:, None, None] + 1e-3)
    ao_accum = (slope * att_flat[:, None, None]).sum(0)  # (H, W)
    ao_accum /= total

    ao_max = ao_accum.max().item()
    if ao_max < 1e-10:
        return torch.ones(h, w, device=device)

    occlusion = ao_accum / ao_max
    return 1.0 - occlusion


def _height_to_ao(
    hmap: torch.Tensor,
    strength: float,
    radius_scale: float,
    num_samples: int,
    falloff: float,
    device: torch.device,
) -> torch.Tensor:
    radii = [2.0 * radius_scale, 10.0 * radius_scale, 40.0 * radius_scale]
    weights = [0.5, 0.3, 0.2]

    combined = sum(
        w * _hbao_pass(hmap, r, num_samples, falloff, device)
        for w, r in zip(weights, radii, strict=True)
    )

    return 1.0 - torch.clamp((1.0 - combined) * strength, 0.0, 1.0)


@material_textures_group.register(
    schema_id="chainner:pytorch:height_to_ao",
    name="Height Map to AO (GPU)",
    description=[
        "Generate an ambient occlusion (AO) map from a height map using a GPU-accelerated multi-scale HBAO algorithm.",
        "Equivalent to the **Height Map to AO** node in the Standard package, but all sample directions are dispatched as a single batched GPU operation. Falls back to CPU PyTorch when no GPU is available.",
        "### Seamless Tiling",
        "Set **Padding** to *Wrap (Tile)* when baking AO for a tiling texture. The node pads the image by the coarsest ray radius on all sides before processing and crops back afterwards, so rays at the image boundary wrap correctly instead of reflecting.",
        "### Tiling / VRAM",
        "**Tile Size** splits the image into overlapping chunks to keep VRAM usage bounded. Each chunk includes a border equal to the coarsest ray radius so rays never cross a tile boundary mid-computation. *Auto* starts at 1024 px and automatically halves on out-of-memory. Larger tiles are faster but use more VRAM; *No Tiling* processes the whole image at once and will crash if VRAM is insufficient.",
        "### Algorithm",
        "Three radius passes — fine (2 px), medium (10 px), coarse (40 px), each multiplied by **Radius Scale** — are blended at 0.5 / 0.3 / 0.2. Within each pass, all **Samples** directions and 4 sub-steps are sampled in one `grid_sample` call. Each pass is independently auto-ranged to [0, 1] so detail at every scale is always visible.",
        "### Parameters",
        "**Strength** is a linear contrast control anchored at white (unoccluded). At 1.0 the full auto-ranged result is used. Values above 1.0 deepen shadows; values below 1.0 lighten towards grey.",
        "**Radius Scale** uniformly scales all three radii. Increase for broader shadows across large features; decrease for tight detail occlusion.",
        "**Samples** sets the number of ray directions. More samples reduce banding at the cost of VRAM. Even at 64 samples the GPU processes them all in one dispatch.",
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
            "All directions are dispatched in one GPU call, so doubling samples "
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

    # Pad by the coarsest ray radius so boundary rays don't hit the image edge.
    # This also serves as the overlap for tiled processing (same distance).
    pad_size = math.ceil(40.0 * radius_scale)
    if padding != PaddingType.NONE:
        img = create_border(img, padding.to_border_type(), Padding.all(pad_size))

    if tile_size == NO_TILING:
        # Process the entire image as one tensor; caller accepts any OOM risk.
        hmap_np = img.squeeze().astype(np.float32)
        hmap = torch.from_numpy(hmap_np).unsqueeze(0).unsqueeze(0).to(device)
        ao = _height_to_ao(hmap, strength, radius_scale, int(samples), falloff, device)
        ao_img = ao.detach().cpu().numpy()[:, :, np.newaxis]  # (H, W, 1)
    else:
        # Tile the image. Overlap = pad_size so each tile has enough context
        # for its longest rays without crossing into a neighbour's data.
        if tile_size == CUSTOM:
            tiler = MaxTileSize(custom_tile_size)
        else:
            tiler = parse_tile_size_input(tile_size, lambda: MaxTileSize(1024))

        def process_tile(tile_np: np.ndarray, _region: Region) -> np.ndarray | Split:
            try:
                tile_2d = tile_np.squeeze().astype(np.float32)
                tensor = torch.from_numpy(tile_2d).unsqueeze(0).unsqueeze(0).to(device)
                ao = _height_to_ao(
                    tensor, strength, radius_scale, int(samples), falloff, device
                )
                return ao.detach().cpu().numpy()[:, :, np.newaxis]  # (H, W, 1)
            except torch.cuda.OutOfMemoryError:
                return Split()

        ao_img = auto_split(img, process_tile, tiler, overlap=pad_size)

    if padding != PaddingType.NONE:
        ao_img = ao_img[pad_size:-pad_size, pad_size:-pad_size]

    return ao_img.squeeze()  # (H, W)
