from __future__ import annotations

import os
import sys
from enum import Enum

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from nodes.impl.caption import get_font_size
from nodes.impl.color.color import Color
from nodes.impl.image_utils import normalize, to_uint8
from nodes.properties.inputs import (
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


class TextAsImageAlignment(Enum):
    LEFT = "left"
    CENTERED = "center"
    RIGHT = "right"


TEXT_AS_IMAGE_ALIGNMENT_LABELS = {
    TextAsImageAlignment.LEFT: "Left",
    TextAsImageAlignment.CENTERED: "Centered",
    TextAsImageAlignment.RIGHT: "Right",
}


class TextAsImagePosition(Enum):
    TOP_LEFT = "top_left"
    TOP_CENTERED = "top_centered"
    TOP_RIGHT = "top_right"
    CENTERED_LEFT = "centered_left"
    CENTERED = "centered"
    CENTERED_RIGHT = "centered_right"
    BOTTOM_LEFT = "bottom_left"
    BOTTOM_CENTERED = "bottom_centered"
    BOTTOM_RIGHT = "bottom_right"


TEXT_AS_IMAGE_POSITION_LABELS = {
    TextAsImagePosition.TOP_LEFT: "Top left",
    TextAsImagePosition.TOP_CENTERED: "Top centered",
    TextAsImagePosition.TOP_RIGHT: "Top right",
    TextAsImagePosition.CENTERED_LEFT: "Centered left",
    TextAsImagePosition.CENTERED: "Centered",
    TextAsImagePosition.CENTERED_RIGHT: "Centered right",
    TextAsImagePosition.BOTTOM_LEFT: "Bottom left",
    TextAsImagePosition.BOTTOM_CENTERED: "Bottom centered",
    TextAsImagePosition.BOTTOM_RIGHT: "Bottom right",
}

TEXT_AS_IMAGE_X_Y_REF_FACTORS = {
    TextAsImagePosition.TOP_LEFT: {"x": np.array([0, 0.5]), "y": np.array([0, 0.5])},
    TextAsImagePosition.TOP_CENTERED: {
        "x": np.array([0.5, 0]),
        "y": np.array([0, 0.5]),
    },
    TextAsImagePosition.TOP_RIGHT: {"x": np.array([1, -0.5]), "y": np.array([0, 0.5])},
    TextAsImagePosition.CENTERED_LEFT: {
        "x": np.array([0, 0.5]),
        "y": np.array([0.5, 0]),
    },
    TextAsImagePosition.CENTERED: {"x": np.array([0.5, 0]), "y": np.array([0.5, 0])},
    TextAsImagePosition.CENTERED_RIGHT: {
        "x": np.array([1, -0.5]),
        "y": np.array([0.5, 0]),
    },
    TextAsImagePosition.BOTTOM_LEFT: {
        "x": np.array([0, 0.5]),
        "y": np.array([1, -0.5]),
    },
    TextAsImagePosition.BOTTOM_CENTERED: {
        "x": np.array([0.5, 0]),
        "y": np.array([1, -0.5]),
    },
    TextAsImagePosition.BOTTOM_RIGHT: {
        "x": np.array([1, -0.5]),
        "y": np.array([1, -0.5]),
    },
}


@create_images_group.register(
    schema_id="chainner:image:text_as_image",
    name="Text As Image",
    description="Create an image using any text.",
    icon="MdTextFields",
    inputs=[
        TextInput("Text", multiline=True),
        BoolInput("Bold", default=False),
        BoolInput("Italic", default=False),
        ColorInput(channels=[3], default=Color.bgr((0, 0, 0))),
        EnumInput(
            TextAsImageAlignment,
            label="Text alignment",
            option_labels=TEXT_AS_IMAGE_ALIGNMENT_LABELS,
            default=TextAsImageAlignment.CENTERED,
        ),
        NumberInput(
            "Width",
            minimum=1,
            maximum=None,
            controls_step=1,
            precision=0,
            default=500,
        ),
        NumberInput(
            "Height",
            minimum=1,
            maximum=None,
            controls_step=1,
            precision=0,
            default=100,
        ),
        EnumInput(
            TextAsImagePosition,
            label="Position",
            option_labels=TEXT_AS_IMAGE_POSITION_LABELS,
            default=TextAsImagePosition.CENTERED,
        ),
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
    color: Color,
    alignment: TextAsImageAlignment,
    width: int,
    height: int,
    position: TextAsImagePosition,
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
        np.sum(np.array([width, w_text]) * TEXT_AS_IMAGE_X_Y_REF_FACTORS[position]["x"])  # type: ignore
    )
    y_ref = round(
        np.sum(
            np.array([height, h_text]) * TEXT_AS_IMAGE_X_Y_REF_FACTORS[position]["y"]  # type: ignore
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
