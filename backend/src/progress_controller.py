import asyncio
from abc import ABC, abstractmethod


class Aborted(Exception):
    pass


class ProgressToken(ABC):
    @property
    @abstractmethod
    def paused(self) -> bool:
        pass

    @property
    @abstractmethod
    def aborted(self) -> bool:
        pass

    @abstractmethod
    async def suspend(self) -> None:
        """
        If the operation was aborted, this method will throw an `Aborted` exception.
        If the operation is paused, this method will wait until the operation is resumed or aborted.
        """


class ProgressController(ProgressToken):
    def __init__(self):
        self.__paused: bool = False
        self.__aborted: bool = False

    @property
    def paused(self) -> bool:
        return self.__paused

    @property
    def aborted(self) -> bool:
        return self.__aborted

    def pause(self):
        self.__paused = True

    def resume(self):
        self.__paused = False

    def abort(self):
        self.__aborted = True

    async def suspend(self) -> None:
        if self.aborted:
            raise Aborted()

        while self.paused:
            await asyncio.sleep(0.1)
            if self.aborted:
                raise Aborted()
