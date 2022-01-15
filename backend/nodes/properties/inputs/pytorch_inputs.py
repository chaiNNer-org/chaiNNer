from typing import Any, OrderedDict


def StateDictInput() -> OrderedDict:
    """ Input a PyTorch state dict """
    return {
        "type": "pytorch::state_dict",
        "label": "State Dict",
    }


def ModelInput() -> Any:
    """ Input a loaded model """
    return {
        "type": "pytorch::model",
        "label": "Loaded Model",
    }


def TorchScriptInput() -> Any:
    """ Input a JIT traced model """
    return {
        "type": "pytorch::torchscript",
        "label": "Traced Model",
    }
