from typing import List
from .category import Category


class Package:
    def __init__(
        self,
        name: str,
        description: str,
        categories: List[Category],
    ):
        self.name: str = name
        self.description: str = description

        self.categories: List[Category] = categories

    def toDict(self):
        return {
            "name": self.name,
            "description": self.description,
            "categories": [category.toDict() for category in self.categories],
        }

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()
