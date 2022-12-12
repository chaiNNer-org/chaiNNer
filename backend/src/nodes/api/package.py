from typing import List
from .category import Category


class Package:
    def __init__(
        self,
        name: str,
        description: str,
        categories: List[Category],
        dependencies: List[str],  # TODO: use an actual dependency class
    ):
        self.name: str = name
        self.description: str = description

        self.categories: List[Category] = categories
        self.dependencies: List[str] = dependencies

    def toDict(self):
        return {
            "name": self.name,
            "description": self.description,
            "categories": [category.toDict() for category in self.categories],
            "dependencies": self.dependencies,
        }

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()

    def __json__(self):
        return self.toDict()
