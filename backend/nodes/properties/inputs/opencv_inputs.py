from typing import Dict, List

from cv2 import COLOR_BGR2BGRA, COLOR_BGRA2BGR, COLOR_BGRA2GRAY, COLOR_GRAY2BGR

from GenericInputs import DropDownInput


def ColorModeInput(input_type: str, label: str, options: List[Dict]) -> str:
    """ Input for submitting a local file """
    return DropDownInput(
        "opencv::colormode",
        "Color Mode",
        [
            {
                "option": "Color -> Grayscale",
                "value": COLOR_BGR2BGRA,
                "inputs": "numpy::2d:3c",
                "outputs": "numpy::2d:1c",
            },
            {
                "option": "Grayscale -> Color",
                "value": COLOR_GRAY2BGR,
                "inputs": "numpy::2d:1c",
                "outputs": "np::2d:3c",
            },
            {
                "option": "Color + Alpha -> Color",
                "value": COLOR_BGRA2BGR,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:3c",
            },
            {
                "option": "Color + Alpha -> Grayscale",
                "value": COLOR_BGRA2GRAY,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:1c",
            },
        ],
    )
