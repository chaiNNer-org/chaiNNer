from abc import ABC, abstractmethod

from .settings import SettingsParser


class Aborted(Exception):
    pass


class NodeProgress(ABC):
    @property
    @abstractmethod
    def aborted(self) -> bool:
        """
        Returns whether the current operation was aborted.
        """

    def check_aborted(self) -> None:
        """
        Raises an `Aborted` exception if the current operation was aborted. Does nothing otherwise.
        """

        if self.aborted:
            raise Aborted()

    @abstractmethod
    def set_progress(self, progress: float) -> None:
        """
        Sets the progress of the current node execution. `progress` must be a value between 0 and 1.

        Raises an `Aborted` exception if the current operation was aborted.
        """


class NodeContext(NodeProgress, ABC):
    """
    The execution context of the current node.
    """

    @property
    @abstractmethod
    def settings(self) -> SettingsParser:
        """
        Returns the settings of the current node execution.
        """
