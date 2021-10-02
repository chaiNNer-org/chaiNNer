from typing import OrderedDict, Any


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
        "label": "Loaded Model",
    }
