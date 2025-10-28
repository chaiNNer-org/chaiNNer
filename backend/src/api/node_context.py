import time
from abc import ABC, abstractmethod
from collections.abc import Callable
from pathlib import Path
from typing import Literal

from .settings import SettingsParser


class Aborted(Exception):
    pass


class Progress(ABC):
    @property
    @abstractmethod
    def aborted(self) -> bool:
        """
        Returns whether the current operation was aborted.
        """

    @property
    @abstractmethod
    def paused(self) -> bool:
        """
        Returns whether the current operation was paused.
        """

    def check_aborted(self) -> None:
        """
        Raises an `Aborted` exception if the current operation was aborted. Does nothing otherwise.
        """

        if self.aborted:
            raise Aborted()

    def suspend(self) -> None:
        """
        If the operation was aborted, this method will throw an `Aborted` exception.
        If the operation is paused, this method will wait until the operation is resumed or aborted.
        """

        while True:
            self.check_aborted()
            if not self.paused:
                break
            time.sleep(0.1)

    @abstractmethod
    def set_progress(self, progress: float) -> None:
        """
        Sets the progress of the current node execution. `progress` must be a value between 0 and 1.

        Raises an `Aborted` exception if the current operation was aborted.
        """

    def sub_progress(self, offset: float, length: float) -> "Progress":
        """
        Returns a new `NodeProgress` object that represents a sub-progress of the current operation.

        The progress range of the sub-progress is defined by `offset` and `length`. `offset` must be a value between 0
        and 1, and `length` must be a positive value such that `offset + length <= 1`.

        The real progress of the sub-progress is calculated as `offset + progress * length`, where `progress` is the
        progress value passed to `set_progress` of the sub-progress.
        """
        return _SubProgress(self, offset, length)

    @staticmethod
    def noop_progress() -> "Progress":
        """
        Returns a `Progress` object that does nothing. It is never paused or aborted and does not report any progress.
        """
        return _NoopProgress()


class _NoopProgress(Progress):
    @property
    def aborted(self) -> Literal[False]:
        return False

    @property
    def paused(self) -> Literal[False]:
        return False

    def check_aborted(self) -> None:
        pass

    def suspend(self) -> None:
        pass

    def set_progress(self, progress: float) -> None:
        pass

    def sub_progress(self, offset: float, length: float) -> "Progress":
        return _NoopProgress()


class _SubProgress(Progress):
    def __init__(self, parent: Progress, offset: float, length: float):
        self._parent = parent
        self._offset = offset
        self._length = length

    @property
    def aborted(self) -> bool:
        return self._parent.aborted

    @property
    def paused(self) -> bool:
        return self._parent.paused

    def check_aborted(self) -> None:
        self._parent.check_aborted()

    def suspend(self) -> None:
        self._parent.suspend()

    def set_progress(self, progress: float) -> None:
        self._parent.set_progress(self._offset + progress * self._length)

    def sub_progress(self, offset: float, length: float) -> "_SubProgress":
        return _SubProgress(
            self._parent,
            offset=self._offset + offset * self._length,
            length=length * self._length,
        )


class NodeContext(Progress, ABC):
    """
    The execution context of the current node.
    """

    @property
    @abstractmethod
    def settings(self) -> SettingsParser:
        """
        Returns the settings of the current node execution.
        """

    @property
    @abstractmethod
    def storage_dir(self) -> Path:
        """
        The path of a directory where nodes can store files.

        This directory persists between node executions, and its contents are shared between different nodes.
        """

    @abstractmethod
    def add_cleanup(
        self, fn: Callable[[], None], after: Literal["node", "chain"] = "chain"
    ) -> None:
        """
        Registers a function that will be called when the chain execution is finished (if set to chain mode) or after node execution is finished (node mode).

        Registering the same function (object) twice will only result in the function being called once.
        """
