from typing import Dict, List

import cv2

from .generic_inputs import DropDownInput


def ColorModeInput() -> Dict:
    """ Converting color mode dropdown """
    return DropDownInput(
        "opencv::colormode",
        "Color Mode",
        [
            {
                "option": "Color -> Grayscale",
                "value": cv2.COLOR_BGR2BGRA,
                "inputs": "numpy::2d:3c",
                "outputs": "numpy::2d:1c",
            },
            {
                "option": "Grayscale -> Color",
                "value": cv2.COLOR_GRAY2BGR,
                "inputs": "numpy::2d:1c",
                "outputs": "np::2d:3c",
            },
            {
                "option": "Color + Alpha -> Color",
                "value": cv2.COLOR_BGRA2BGR,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:3c",
            },
            {
                "option": "Color + Alpha -> Grayscale",
                "value": cv2.COLOR_BGRA2GRAY,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:1c",
            },
        ],
    )


def InterpolationInput() -> Dict:
    """ Resize interpolation dropdown """
    return DropDownInput(
        "generic",
        "Interpolation Mode",
        [
            {
                "option": "Nearest Neighbor",
                "value": cv2.INTER_NEAREST,
            },
            {
                "option": "Box (Area)",
                "value": cv2.INTER_AREA,
            },
            {
                "option": "Linear",
                "value": cv2.INTER_LINEAR,
            },
            {
                "option": "Cubic",
                "value": cv2.INTER_CUBIC,
            },
            {
                "option": "Lanczos",
                "value": cv2.INTER_LANCZOS4,
            },
        ],
    )
