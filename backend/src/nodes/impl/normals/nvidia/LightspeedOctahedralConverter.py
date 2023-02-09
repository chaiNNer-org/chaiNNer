"""
* SPDX-FileCopyrightText: Copyright (c) 2023 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
* SPDX-License-Identifier: MIT
*
* Permission is hereby granted, free of charge, to any person obtaining a
* copy of this software and associated documentation files (the "Software"),
* to deal in the Software without restriction, including without limitation
* the rights to use, copy, modify, merge, publish, distribute, sublicense,
* and/or sell copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
* THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
* DEALINGS IN THE SOFTWARE.
"""

# This code has been modified from its original form

import numpy as np


# Converts either OpenGL or DirectX style normal maps to RTX Remix compatible Hemispherical Octahedral maps.
#
# Note that normals pointing in to the surface are not physically possible, and are not supported by RTX Remix.
#   Any images with inward pointing normals will generate a warning and will be flipped to point outwards.
#
# There is a good explanation of DirectX vs OpenGL normal maps at
#   https://www.texturecan.com/post/3/DirectX-vs-OpenGL-Normal-Map/
#
# To then load these into RTX Remix, you can convert it to a DDS file using
#   https://developer.nvidia.com/nvidia-texture-tools-exporter
#   Use BC5 compression, and the flag --no-mip-gamma-correct
class LightspeedOctahedralConverter:
    # Convert DirectX style normal maps (green is down)
    @staticmethod
    def convert_dx_to_octahedral(normals):
        octahedrals = LightspeedOctahedralConverter._convert_to_octahedral(normals)
        return LightspeedOctahedralConverter._octahedrals_to_pixels(octahedrals)

    # Convert OpenGL style normal maps (green is up)
    @staticmethod
    def convert_ogl_to_octahedral(image):
        dx_image = LightspeedOctahedralConverter.ogl_to_dx(image)
        return LightspeedOctahedralConverter.convert_dx_to_octahedral(dx_image)

    @staticmethod
    def _octahedrals_to_pixels(octahedrals):
        return np.pad(octahedrals, ((0, 0), (0, 0), (0, 1)), mode="constant")  # type: ignore

    @staticmethod
    def ogl_to_dx(image):
        # flip the g channel to convert to DX style
        image[:, :, (1)] = 1 - image[:, :, (1)]
        return image

    @staticmethod
    def _convert_to_octahedral(image):
        # convert from 3 channel to 2 channel normal map
        abs_values = np.absolute(image)
        snorm_octahedrals = image[:, :, 0:2] / np.expand_dims(abs_values.sum(2), axis=2)
        # Hemisphere normal handling:
        result = snorm_octahedrals.copy()
        result[:, :, 0] = snorm_octahedrals[:, :, 0] + snorm_octahedrals[:, :, 1]
        result[:, :, 1] = snorm_octahedrals[:, :, 0] - snorm_octahedrals[:, :, 1]
        return result
