from typing import Union, List
from .sub_category import SubCategory


class Category:
    def __init__(
        self,
        name: str,
        description: str,
        icon: str,
        color: str,
        install_hint: Union[str, None] = None,
        sub_categories: Union[List[SubCategory], None] = None,
    ):
        self.name: str = name
        self.description: str = description
        self.icon: str = icon
        self.color: str = color
        self.install_hint: Union[str, None] = install_hint

        self.sub_categories: List[SubCategory] = (
            sub_categories if sub_categories is not None else []
        )

    def toDict(self, package_author: str, package_name: str):
        return {
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "color": self.color,
            "installHint": self.install_hint,
            "subCategories": [
                sub.toDict(package_author, package_name) for sub in self.sub_categories
            ],
        }
