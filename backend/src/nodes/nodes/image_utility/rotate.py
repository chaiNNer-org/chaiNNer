from __future__ import annotations

import numpy as np

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import (
    ImageInput,
    SliderInput,
    RotateInterpolationInput,
    RotateExpansionInput,
    FillColorDropdown,
)
from ...properties.outputs import ImageOutput
from ...utils.pil_utils import rotate


@NodeFactory.register("chainner:image:rotate")
class RotateNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Rotate an image."
        self.inputs = [
            ImageInput("Image"),
            SliderInput(
                "Rotation Angle",
                default=0,
                maximum=360,
                precision=1,
                controls_step=45,
                slider_step=1,
                unit="°",
            ),
            RotateInterpolationInput(),
            RotateExpansionInput(),
            FillColorDropdown(),
        ]
        self.outputs = [
            ImageOutput(
                image_type="""
                // This is a near verbatim copy of PIL's rotate code
                // to get the size of the rotated image.
                // https://pillow.readthedocs.io/en/stable/_modules/PIL/Image.html#Image.rotate
                struct Point { x: number, y: number }

                let rot_center = Point {
                    x: Input0.width / 2,
                    y: Input0.height / 2,
                };

                let angle = -degToRad(Input1);
                let m0 = cos(angle);
                let m1 = sin(angle);
                let m2 = rot_center.x + m0 * -rot_center.x + m1 * -rot_center.y;
                let m3 = -sin(angle);
                let m4 = cos(angle);
                let m5 = rot_center.y + m3 * -rot_center.x + m4 * -rot_center.y;

                def transform(x: number, y: number) {
                    Point {
                        x: m0 * x + m1 * y + m2,
                        y: m3 * x + m4 * y + m5,
                    }
                }

                let p0 = transform(0, 0);
                let p1 = transform(Input0.width, 0);
                let p2 = transform(Input0.width, Input0.height);
                let p3 = transform(0, Input0.height);

                let expandWidth = uint & (
                    ceil(max(p0.x, p1.x, p2.x, p3.x))
                    - floor(min(p0.x, p1.x, p2.x, p3.x))
                );
                let expandHeight = uint & (
                    ceil(max(p0.y, p1.y, p2.y, p3.y))
                    - floor(min(p0.y, p1.y, p2.y, p3.y))
                );

                Image {
                    width: match Input3 {
                        RotateSizeChange::Crop => Input0.width,
                        _ => expandWidth
                    },
                    height: match Input3 {
                        RotateSizeChange::Crop => Input0.height,
                        _ => expandHeight
                    },
                    channels: FillColor::getOutputChannels(Input4, Input0.channels)
                }
                """
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Rotate"
        self.icon = "MdRotate90DegreesCcw"
        self.sub = "Modification"

    def run(
        self, img: np.ndarray, angle: float, interpolation: int, expand: int, fill: int
    ) -> np.ndarray:
        return rotate(img, angle, interpolation, expand, fill)
