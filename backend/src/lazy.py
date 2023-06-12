from __future__ import annotations

from typing import Callable, Generic, TypeVar, cast

from sanic.log import logger

T = TypeVar("T")


class Lazy(Generic[T]):
    def __init__(self, compute: Callable[[], T], log: str | None = None) -> None:
        super().__init__()

        self.__compute = compute
        self.__did_compute = False
        self.__computed_value = None
        self.__log = log

    @property
    def value(self) -> T:
        if self.__did_compute:
            return cast(T, self.__computed_value)

        self.__computed_value = self.__compute()
        if self.__log:
            logger.info(f"Computed lazy value: {self.__log}")
        self.__did_compute = True
        return self.__computed_value
