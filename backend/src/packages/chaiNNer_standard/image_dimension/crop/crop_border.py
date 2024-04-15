from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

import numpy as np

from nodes.properties.inputs import EnumInput, ImageInput, NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import Padding, Region, get_h_w_c

from .. import crop_group


class SelectMode(Enum):
    ALL_SECTIONS = 1
    CENTER_SECTION = 2
    LARGEST_SECTION = 3


@crop_group.register(
    schema_id="chainner:image:remove_border",
    name="Crop Border",
    description=[
        "Remove the border around the content of an image. The border is assumed to have an approximately constant color. This node can also be used to crop images with an approximately constant background color.",
        "The color of the border is automatically determined by the median color of the pixels of a 1px border around the image. The *Tolerance* option can be used to adjust the sensitivity of the color matching. A tolerance of 0% means that a pixel must match the border color exactly, while a tolerance of 5% (default) give a bit of leeway to handle e.g. slight compression artifacts.",
    ],
    icon="MdCrop",
    inputs=[
        ImageInput(),
        SliderInput(
            "Tolerance",
            default=5,
            minimum=0,
            maximum=30,
            controls_step=1,
            precision=1,
            unit="%",
        ),
        EnumInput(
            SelectMode, "Select", default=SelectMode.ALL_SECTIONS, label_style="inline"
        ).with_docs(
            "Determines which sections of the image will be selected as the output image.",
            "To support removing the border of images with captions (or other information in the border), the *Select* option can be used to select which content section of the image will be returned by the node. The available options are as follows:",
            "- All Sections: A single crop containing all sections will be returned.\n"
            "- Center Section: The section closest to the center of the image will be returned.\n"
            "- Largest Section: The largest section will be returned.",
            "So if the image has a border and a caption, *All* will return the inner image + caption, *Center*/*Largest* will return only the inner image (assuming the caption isn't larger than the inner image).",
        ),
        NumberInput("Padding", default=0, minimum=0, maximum=1000, unit="px").with_docs(
            "Additional padding around the selected section.",
            "This can be used to avoid cutting off parts of the image that are close to the border.",
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let pad = Input3;

                Image {
                    width: min(max(uint, 1 + 2 * pad), Input0.width),
                    height: min(max(uint, 1 + 2 * pad), Input0.height),
                    channels: Input0.channels,
                }
                """,
            assume_normalized=True,
        ),
    ],
)
def crop_border_node(
    img: np.ndarray, tolerance: float, select: SelectMode, padding: int
) -> np.ndarray:
    tolerance /= 100

    h, w, c = get_h_w_c(img)

    # find the border color of the border
    border_color = get_border_color(img)

    # figure out which pixels are likely part of the border
    diff: np.ndarray = np.abs(img - border_color)
    if c > 1:
        # make grayscale
        diff = np.mean(diff, axis=-1)
    is_content = diff > tolerance

    # get crop region crop bounds
    crop = get_crop_region(is_content, select)
    crop = crop.add_padding(Padding.all(padding))
    crop = crop.intersect(Region(0, 0, w, h))

    return crop.read_from(img)


def get_crop_region(is_content: np.ndarray, select: SelectMode) -> Region:
    assert is_content.ndim == 2

    # 1. crop horizontally
    is_content_horizontal = np.any(is_content, axis=0)
    section_w = get_inner_section(is_content_horizontal, select)
    is_content = is_content[:, section_w.start : section_w.end]

    # 2. crop vertically
    is_content_vertical = np.any(is_content, axis=1)
    section_h = get_inner_section(is_content_vertical, select)
    is_content = is_content[section_h.start : section_h.end, :]

    crop = Region(
        section_w.start,
        section_h.start,
        section_w.length,
        section_h.length,
    )

    if select != SelectMode.ALL_SECTIONS:
        # 3. crop horizontally again to remove any remaining border
        is_content_horizontal = np.any(is_content, axis=0)
        section_w = get_inner_section(is_content_horizontal, SelectMode.ALL_SECTIONS)
        crop = Region(
            crop.x + section_w.start,
            crop.y,
            section_w.length,
            crop.height,
        )

    return crop


def get_border_color(img: np.ndarray):
    """
    Returns the median color in the 1px border of the image.
    """
    # Get the 1px border of the image
    top = img[0, :, ...]
    bottom = img[-1, :, ...]
    left = img[:, 0, ...]
    right = img[:, -1, ...]
    border = np.concatenate((top, bottom, left, right), axis=0)
    # Get the median color
    return np.median(border, axis=0)


@dataclass(frozen=True)
class Section:
    start: int
    end: int

    @property
    def length(self) -> int:
        return self.end - self.start

    def union(self, other: Section) -> Section:
        return Section(min(self.start, other.start), max(self.end, other.end))

    def distance_to(self, index: int) -> int:
        if index < self.start:
            return self.start - index
        if index >= self.end:
            return index - self.end
        return 0


def get_inner_section(is_content: np.ndarray, select: SelectMode) -> Section:
    assert is_content.ndim == 1
    size = len(is_content)

    # find all content sections in the image
    sections: list[Section] = []
    start = None
    for i in range(size):
        if not is_content[i]:
            if start is not None:
                sections.append(Section(start, i))
                start = None
        elif start is None:
            start = i
    if start is not None:
        sections.append(Section(start, size))
        start = None
    if len(sections) == 0:
        return Section(0, size)

    # select the relevant section
    if select == SelectMode.ALL_SECTIONS:
        return sections[0].union(sections[-1])
    if select == SelectMode.CENTER_SECTION:
        distances = [section.distance_to(size // 2) for section in sections]
        return sections[np.argmin(distances)]
    if select == SelectMode.LARGEST_SECTION:
        return max(sections, key=lambda section: section.length)
