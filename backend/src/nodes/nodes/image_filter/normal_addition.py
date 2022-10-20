from __future__ import annotations

import cv2
import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, SliderInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.image_utils import normalize_normals


@NodeFactory.register("chainner:image:add_normals")
class NormalAdditionNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Add 2 normal maps together. Only the R and G
            channels of the input image will be used. The output normal map
            is guaranteed to be normalized."""
        self.inputs = [
            ImageInput("Normal Map 1", channels=[3, 4]),
            SliderInput("Strength 1", maximum=100, default=100),
            ImageInput("Normal Map 2", channels=[3, 4]),
            SliderInput("Strength 2", maximum=100, default=100),
        ]
        self.outputs = [
            ImageOutput(
                "Normal Map",
                image_type=expression.Image(
                    width="Input0.width & Input2.width",
                    height="Input0.height & Input2.height",
                ),
                channels=3,
            ).with_never_reason(
                "The given normal maps have different sizes but must be the same size."
            ),
        ]
        self.category = ImageFilterCategory
        self.name = "Add Normals"
        self.icon = "MdAddCircleOutline"
        self.sub = "Normal Map"

    def run(
        self, n: np.ndarray, n_strength: int, m: np.ndarray, m_strength: int
    ) -> np.ndarray:
        """
        Takes 2 normal maps and adds them.

        The addition works by converting the normals into 2D slopes and then adding
        the slopes. The sum of the slopes is then converted back into normals.

        When adding 2 normal maps, the normals themselves are not added;
        Instead, the heightmaps that those normals represent are added.
        Conceptually, this entails converting the normals into slopes
        (the derivatives of the heightmap), integrating the slopes to get
        the heightmaps, adding the heightmaps, then performing the reverse
        on the added heightmaps. Practically, this is unnecessary, as adding
        the slopes together is equivalent to adding the heightmaps.
        """

        n_norm_strength = n_strength / 100
        m_norm_strength = m_strength / 100

        # Convert BGR to XY
        n_x = n[:, :, 2] * 2 - 1
        n_y = n[:, :, 1] * 2 - 1
        m_x = m[:, :, 2] * 2 - 1
        m_y = m[:, :, 1] * 2 - 1

        n_x, n_y, n_z = normalize_normals(n_x, n_y)
        m_x, m_y, m_z = normalize_normals(m_x, m_y)

        # Slopes aren't defined for z=0, so set to near-zero decimal
        n_z = np.maximum(n_z, 0.001, out=n_z)
        m_z = np.maximum(m_z, 0.001, out=m_z)

        # This works as follows:
        # 1. Use the normals n,m to calculate 3D planes (the slopes) centered at origin p_n,p_m.
        # 2. Calculate the Z values of those planes at a_xy=(1,0) and b_xy=(0,1).
        # 3. Add the Z values to together (weighted using their strength):
        #    a_z = p_n[a_xy] * n_strength + p_m[a_xy] * m_strength, same for b_xy.
        # 4. Define a=(1,0,a_z), b=(0,1,b_z).
        # 5. The final normal will be normalize(cross(a,b)).
        # This works out as:

        n_f = n_norm_strength / n_z
        m_f = m_norm_strength / m_z
        a_z = n_x * n_f + m_x * m_f
        b_z = n_y * n_f + m_y * m_f

        l_r = 1 / np.sqrt(np.square(a_z) + np.square(b_z) + 1)
        x = a_z * l_r
        y = b_z * l_r
        z = l_r

        r_norm = (x + 1) * 0.5
        g_norm = (y + 1) * 0.5
        b_norm = z

        return cv2.merge((b_norm, g_norm, r_norm))
