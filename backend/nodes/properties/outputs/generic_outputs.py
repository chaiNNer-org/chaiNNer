from .base_output import BaseOutput


def NumberOutput(label: str):
    """Output for arbitrary number"""
    return BaseOutput("number::any", label)


def IntegerOutput(label: str):
    """Output for integer number"""
    return BaseOutput("number::integer", label)


def TextOutput(label: str):
    """Output for arbitrary text"""
    return BaseOutput("text::any", label)
