from .base_output import BaseOutput


def NcnnModelOutput(label: str = "Model"):
    """Output for NcnnModel object"""
    return BaseOutput("NcnnNetwork", label)
