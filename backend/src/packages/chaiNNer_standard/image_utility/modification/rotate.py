from __future__ import annotations

import numpy as np

from nodes.impl.pil_utils import (
    FillColor,
    RotateSizeChange,
    RotationInterpolationMethod,
    rotate,
)
from nodes.properties.inputs import (
    EnumInput,
    FillColorDropdown,
    ImageInput,
    RotateInterpolationInput,
    SliderInput,
)
from nodes.properties.outputs import ImageOutput

from .. import modification_group


@modification_group.register(
    schema_id="chainner:image:rotate",
    name="Rotate",
    description="Rotate an image.",
    icon="MdRotate90DegreesCcw",
    inputs=[
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
        EnumInput(
            RotateSizeChange,
            label="Image Dimensions",
            option_labels={
                RotateSizeChange.EXPAND: "Expand to fit",
                RotateSizeChange.CROP: "Crop to original",
            },
        ),
        FillColorDropdown(),
    ],
    outputs=[
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

                let angle = -number::degToRad(Input1);
                let m0 = number::cos(angle);
                let m1 = number::sin(angle);
                let m2 = rot_center.x + m0 * -rot_center.x + m1 * -rot_center.y;
                let m3 = -number::sin(angle);
                let m4 = number::cos(angle);
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
                """,
            assume_normalized=True,
        )
    ],
)
def rotate_node(
    img: np.ndarray,
    angle: float,
    interpolation: RotationInterpolationMethod,
    expand: RotateSizeChange,
    fill: FillColor,
) -> np.ndarray:
    return rotate(img, angle, interpolation, expand, fill)
