from typing import Dict


def NcnnNetInput(label: str = "Network") -> Dict:
    """Input for ncnn network"""
    return {
        "type": "ncnn::net",
        "label": label,
    }
