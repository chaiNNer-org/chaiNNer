from typing import List
from .category import Category


class Package:
    def __init__(
        self,
        author: str,
        name: str,
        description: str,
        categories: List[Category],
        dependencies: List[str],  # TODO: use an actual dependency class
    ):
        self.__author: str = author
        self.__name: str = name
        self.__description: str = description

        self.__categories: List[Category] = categories
        self.__dependencies: List[str] = dependencies

    def toDict(self):
        return {
            "name": self.__name,
            "description": self.__description,
            "categories": [
                category.toDict(self.__author, self.__name)
                for category in self.__categories
            ],
            "dependencies": self.__dependencies,
        }

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()

    def __json__(self):
        return self.toDict()

    @property
    def author(self):
        return self.__author

    @property
    def name(self):
        return self.__name

    @property
    def description(self):
        return self.__description

    @property
    def categories(self):
        return self.__categories

    @property
    def dependencies(self):
        return self.__dependencies
