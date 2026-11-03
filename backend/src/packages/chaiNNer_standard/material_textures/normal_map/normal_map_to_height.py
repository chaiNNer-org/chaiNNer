from __future__ import annotations

import navi
import numpy as np
from nodes.properties.inputs import BoolInput, ImageInput
from nodes.properties.outputs import ImageOutput

from .. import normal_map_group


@normal_map_group.register(
    schema_id="chainner:image:normal_to_height",
    name="Normal Map to Height",
    description=[
        "Convert a normal map to a height map using high-quality FFT (Fast Fourier Transform) integration.",
        "This method provides superior results compared to simple gradient integration by solving the Poisson equation in frequency domain.",
        "### Input",
        "The input should be a normal map where:",
        "- Red channel (R) contains the X component",
        "- Green channel (G) contains the Y component",
        "- Blue channel (B) contains the Z component",
        "### Parameters",
        "**Invert Green**: Enable this if your normal map uses DirectX format (OpenGL normal maps typically don't need this).",
        "**Invert Output**: Swaps black and white in the output height map.",
    ],
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput("Normal Map", channels=[3, 4]),
        BoolInput("Invert Green", default=False)
        .with_docs(
            "Invert the green (Y) channel before processing. Enable this for DirectX normal maps, disable for OpenGL normal maps.",
            hint=True,
        )
        .with_id(1),
        BoolInput("Invert Output", default=False)
        .with_docs(
            "Invert the output height map, swapping black and white values.",
            hint=True,
        )
        .with_id(2),
    ],
    outputs=[
        ImageOutput(
            "Height Map",
            size_as=0,
            image_type=navi.Image(channels=1),
        ),
    ],
)
def normal_map_to_height_node(
    img: np.ndarray,
    invert_green: bool,
    invert_output: bool,
) -> np.ndarray:
    """
    Convert a normal map to a height map using FFT-based Poisson integration.
    """
    # Normalize normal map from [0, 1] to [-1, 1]
    normal = img.astype(np.float32)
    normal = (normal - 0.5) * 2.0

    # Extract gradients from normal map
    # Note: OpenCV uses BGR, so Blue=2, Green=1, Red=0
    # In normal maps: R=X, G=Y, B=Z
    # So we want: dx from Red (index 2 in BGR), dy from Green (index 1 in BGR)
    dx = normal[:, :, 2]  # Red channel = X gradient
    dy = normal[:, :, 1]  # Green channel = Y gradient

    # Invert green channel if specified (DirectX vs OpenGL convention)
    if invert_green:
        dy = -dy

    # Solve Poisson equation using FFT
    rows, cols = dx.shape

    # Create frequency domain grids
    u = np.fft.fftfreq(cols)
    v = np.fft.fftfreq(rows)
    u, v = np.meshgrid(u, v)

    # Transform gradients to frequency domain
    dx_fft = np.fft.fft2(dx)
    dy_fft = np.fft.fft2(dy)

    # Compute denominator (avoid division by zero at DC component)
    denom = u**2 + v**2
    denom[0, 0] = 1  # Avoid division by zero at DC

    # Solve in frequency domain: H = -i(u*DX + v*DY) / (u^2 + v^2)
    height_fft = -1j * (u * dx_fft + v * dy_fft) / (denom + 1e-12)

    # Transform back to spatial domain
    height = np.real(np.fft.ifft2(height_fft))

    # Handle any NaN values
    height = np.nan_to_num(height)

    # Normalize to [0, 1] range
    h_min = np.min(height)
    h_max = np.max(height)
    height_norm = (height - h_min) / (h_max - h_min + 1e-5)

    # Invert output if specified
    if invert_output:
        height_norm = 1.0 - height_norm

    # Return as float32 single channel
    return height_norm.astype(np.float32)
