from typing import Dict


def StateDictOutput() -> Dict:
    """Output a PyTorch state dict"""
    return {
        "type": "pytorch::state_dict",
        "label": "State Dict",
    }


def ModelOutput() -> Dict:
    """Output a loaded model"""
    return {
        "type": "pytorch::model",
        "label": "Model",
    }


def TorchScriptOutput() -> Dict:
    """Output a JIT traced model"""
    return {
        "type": "pytorch::torchscript",
        "label": "Traced Model",
    }
