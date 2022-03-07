from typing import Any, OrderedDict


def StateDictOutput() -> OrderedDict:
    """ Output a PyTorch state dict """
    return {
        "type": "pytorch::state_dict",
        "label": "State Dict",
    }


def ModelOutput() -> Any:
    """ Output a loaded model """
    return {
        "type": "pytorch::model",
        "label": "Model",
    }


def TorchScriptOutput() -> Any:
    """ Output a JIT traced model """
    return {
        "type": "pytorch::torchscript",
        "label": "Traced Model",
    }
