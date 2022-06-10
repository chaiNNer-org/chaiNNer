from .base_output import BaseOutput


def NumberOutput(label: str):
    """Output for arbitrary number"""
    return BaseOutput("number", label)


def IntegerOutput(label: str):
    """Output for integer number"""
    return BaseOutput("int", label)


def TextOutput(label: str):
    """Output for arbitrary text"""
    return BaseOutput("string", label)
