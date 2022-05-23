from .base_output import BaseOutput


def NcnnNetOutput(label: str = "Model"):
    """Output for ncnn network"""
    return BaseOutput("ncnn::net", label)
