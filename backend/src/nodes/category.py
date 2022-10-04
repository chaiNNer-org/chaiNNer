from typing import Union


class Category:
    def __init__(
        self,
        name: str,
        description: str,
        icon: str,
        color: str,
        install_hint: Union[str, None] = None,
    ):
        self.name: str = name
        self.description: str = description
        self.icon: str = icon
        self.color: str = color
        self.install_hint: Union[str, None] = install_hint

    def toDict(self):
        return {
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "color": self.color,
            "installHint": self.install_hint,
        }

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()
