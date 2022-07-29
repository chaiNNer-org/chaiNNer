from .base_output import BaseOutput


def NcnnNetOutput(label: str = "Model"):
    """Output for ncnn network"""
    return BaseOutput("NcnnNetwork", label)


def NcnnModelOutput(label: str = "Model"):
    """Output for NcnnModel object"""
    return BaseOutput("NcnnNetwork", label)
