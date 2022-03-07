from typing import Dict


def NcnnNetOutput(label: str = 'Network') -> Dict:
    """ Output for ncnn network """
    return {
        "type": "ncnn::net",
        "label": label,
    }
