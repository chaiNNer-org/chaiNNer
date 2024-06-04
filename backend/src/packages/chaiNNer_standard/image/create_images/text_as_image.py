from __future__ import annotations

import os
import sys
from enum import Enum

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from nodes.groups import icon_set_group, menu_icon_row_group
from nodes.impl.caption import get_font_size
from nodes.impl.color.color import Color
from nodes.impl.image_utils import normalize, to_uint8
from nodes.properties.inputs import (
    Anchor,
    AnchorInput,
    BoolInput,
    ColorInput,
    EnumInput,
    NumberInput,
    TextInput,
)
from nodes.properties.outputs import ImageOutput

from .. import create_images_group

TEXT_AS_IMAGE_FONT_PATH = [
    [
        "Roboto/Roboto-Regular.ttf",
        "Roboto/Roboto-Italic.ttf",
    ],
    ["Roboto/Roboto-Bold.ttf", "Roboto/Roboto-BoldItalic.ttf"],
]


class TextAlignment(Enum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"


X_Y_REF_FACTORS = {
    Anchor.TOP_LEFT: {"x": np.array([0, 0.5]), "y": np.array([0, 0.5])},
    Anchor.TOP: {"x": np.array([0.5, 0]), "y": np.array([0, 0.5])},
    Anchor.TOP_RIGHT: {"x": np.array([1, -0.5]), "y": np.array([0, 0.5])},
    Anchor.LEFT: {"x": np.array([0, 0.5]), "y": np.array([0.5, 0])},
    Anchor.CENTER: {"x": np.array([0.5, 0]), "y": np.array([0.5, 0])},
    Anchor.RIGHT: {"x": np.array([1, -0.5]), "y": np.array([0.5, 0])},
    Anchor.BOTTOM_LEFT: {"x": np.array([0, 0.5]), "y": np.array([1, -0.5])},
    Anchor.BOTTOM: {"x": np.array([0.5, 0]), "y": np.array([1, -0.5])},
    Anchor.BOTTOM_RIGHT: {"x": np.array([1, -0.5]), "y": np.array([1, -0.5])},
}


@create_images_group.register(
    schema_id="chainner:image:text_as_image",
    name="Text As Image",
    description="Create an image using any text.",
    icon="MdTextFields",
    inputs=[
        TextInput("Text", multiline=True, label_style="hidden"),
        menu_icon_row_group()(
            icon_set_group("Style")(
                BoolInput("Bold", default=False, icon="FaBold").with_id(1),
                BoolInput("Italic", default=False, icon="FaItalic").with_id(2),
            ),
            EnumInput(
                TextAlignment,
                label="Alignment",
                preferred_style="icons",
                icons={
                    TextAlignment.LEFT: "FaAlignLeft",
                    TextAlignment.CENTER: "FaAlignCenter",
                    TextAlignment.RIGHT: "FaAlignRight",
                },
                default=TextAlignment.CENTER,
            ).with_id(4),
        ),
        ColorInput(channels=[3], default=Color.bgr((0, 0, 0))).with_id(3),
        NumberInput("Width", min=1, max=None, default=500, unit="px").with_id(5),
        NumberInput("Height", min=1, max=None, default=100, unit="px").with_id(6),
        AnchorInput(label="Position", icon="MdTextFields").with_id(7),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                Image {
                    width: Input5,
                    height: Input6,
                }
                """,
            channels=4,
            assume_normalized=True,
        )
    ],
)
def text_as_image_node(
    text: str,
    bold: bool,
    italic: bool,
    alignment: TextAlignment,
    color: Color,
    width: int,
    height: int,
    position: Anchor,
) -> np.ndarray:
    path = TEXT_AS_IMAGE_FONT_PATH[int(bold)][int(italic)]
    font_path = os.path.join(
        os.path.dirname(sys.modules["__main__"].__file__),  # type: ignore
        f"fonts/{path}",  # type: ignore
    )

    lines = text.split("\n")
    line_count, max_line = len(lines), max(lines, key=len)

    # Use a text as reference to get max size
    font = ImageFont.truetype(font_path, size=100)
    w_ref, h_ref = get_font_size(font, max_line)[0], get_font_size(font, "[§]")[1]

    # Calculate font size to fill the specified image size
    w = int(width * 100.0 / w_ref)
    h = int(height * 100.0 / (h_ref * line_count))
    font_size = min(w, h)
    font = ImageFont.truetype(font_path, size=font_size)
    w_text, h_text = get_font_size(font, max_line)
    h_text *= line_count

    # Text color
    ink = tuple(to_uint8(np.array(color.value)))

    # Create a PIL image to add text
    pil_image = Image.new("RGBA", (width, height))
    drawing = ImageDraw.Draw(pil_image)

    x_ref = round(
        np.sum(np.array([width, w_text]) * X_Y_REF_FACTORS[position]["x"])  # type: ignore
    )
    y_ref = round(
        np.sum(
            np.array([height, h_text]) * X_Y_REF_FACTORS[position]["y"]  # type: ignore
        )
    )

    drawing.text(
        (x_ref, y_ref),
        text,
        font=font,
        anchor="mm",
        align=alignment.value,
        fill=ink,  # type: ignore
    )

    img = normalize(np.array(pil_image))

    return img
