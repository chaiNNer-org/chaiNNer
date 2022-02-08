from typing import Dict


def NumberOutput(label: str) -> Dict:
    """ Output for arbitrary number """
    return {
        "type": "number::any",
        "label": label,
    }

def IntegerOutput(label: str) -> Dict:
    """ Output for integer number """
    return {
        "type": "number::integer",
        "label": label,
    }
