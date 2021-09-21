from typing import Dict, List

import cv2

from GenericInputs import DropDownInput


def ColorModeInput(type: str, label: str, options: List[Dict]) -> str:
    """ Input for submitting a local file """
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
