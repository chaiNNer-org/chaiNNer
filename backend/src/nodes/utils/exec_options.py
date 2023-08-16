from __future__ import annotations

from typing import Dict, Optional

from sanic.log import logger

PackageExecutionOptions = Dict[str, str]
JsonExecutionOptions = Dict[str, PackageExecutionOptions]


class ExecutionOptions:
    def __init__(
        self,
        backend_settings: JsonExecutionOptions,
    ) -> None:
        self.__settings = backend_settings

        logger.info(f"Execution options: {self.__settings}")

    def get_package_settings(self, package_id: str) -> PackageExecutionOptions:
        return self.__settings.get(package_id, {})


__global_exec_options = ExecutionOptions({})


def get_execution_options() -> ExecutionOptions:
    return __global_exec_options


def set_execution_options(value: ExecutionOptions):
    # TODO: Make the mutable global state unnecessary
    # pylint: disable=global-statement
    global __global_exec_options
    __global_exec_options = value


def parse_execution_options(json: JsonExecutionOptions) -> ExecutionOptions:
    return ExecutionOptions(backend_settings=json)
