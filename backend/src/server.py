from __future__ import annotations

import asyncio
import gc
import importlib
import logging
import sys
import tempfile
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from functools import cached_property
from json import dumps as stringify
from pathlib import Path
from typing import Final, TypedDict

from sanic import Sanic
from sanic.log import access_logger, logger
from sanic.request import Request
from sanic.response import json
from sanic_cors import CORS

import api
from api import (
    ExecutionOptions,
    Group,
    JsonExecutionOptions,
    NodeId,
)
from chain.cache import OutputCache
from chain.chain import Chain, FunctionNode
from chain.json import JsonNode, parse_json
from chain.optimize import optimize
from dependencies.store import installed_packages
from events import EventConsumer, EventQueue, ExecutionErrorData
from process import ExecutionId, Executor, NodeExecutionError, NodeOutput
from progress_controller import Aborted
from response import (
    already_running_response,
    error_response,
    no_executor_response,
    success_response,
)
from server_config import ServerConfig


class AppContext:
    def __init__(self):
        self.config: Final[ServerConfig] = ServerConfig.parse_argv()
        self.executor: Executor | None = None
        self.individual_executors: dict[ExecutionId, Executor] = {}
        self.cache: dict[NodeId, NodeOutput] = {}
        self.pool: Final[ThreadPoolExecutor] = ThreadPoolExecutor(max_workers=4)

    @cached_property
    def queue(self) -> EventQueue:
        return EventQueue()

    @cached_property
    def storage_dir(self) -> Path:
        if self.config.storage_dir is not None:
            logger.info(f"Using given storage directory: {self.config.storage_dir}")
            return Path(self.config.storage_dir)

        default_sub_dir = "chaiNNer/backend-storage"

        # try using the chaiNNer's app dir
        try:
            # appdirs is likely only installed on dev machines
            from appdirs import user_data_dir

            app_data_dir = Path(user_data_dir(roaming=True)) / default_sub_dir
            logger.info(f"Using app data as storage directory: {app_data_dir}")
            return app_data_dir
        except:  # noqa: E722
            # ignore errors
            pass

        # last resort: use the system's temporary directory
        temp = Path(tempfile.gettempdir()) / default_sub_dir
        logger.info(f"No storage directory given. Using temporary directory: {temp}")
        return Path(temp)

    @staticmethod
    def get(app_instance: Sanic) -> AppContext:
        assert isinstance(app_instance.ctx, AppContext)
        return app_instance.ctx


app = Sanic("chaiNNer_executor", ctx=AppContext())
app.config.REQUEST_TIMEOUT = sys.maxsize
app.config.RESPONSE_TIMEOUT = sys.maxsize
CORS(app)


class SSEFilter(logging.Filter):
    def filter(self, record):  # noqa: ANN001
        request = record.request  # type: ignore
        return not (
            (request.endswith("/sse")) and record.status == 200  # type: ignore
        )


class ZeroCounter:
    def __init__(self) -> None:
        self.count = 0

    async def wait_zero(self) -> None:
        while self.count != 0:
            await asyncio.sleep(0.01)

    def __enter__(self):
        self.count += 1

    def __exit__(self, _exc_type: object, _exc_value: object, _exc_traceback: object):
        self.count -= 1


run_individual_counter = ZeroCounter()

setup_task = None


async def nodes_available():
    if setup_task is not None:
        await setup_task


access_logger.addFilter(SSEFilter())


@app.route("/nodes")
async def nodes(_request: Request):
    """Gets a list of all nodes as well as the node information"""
    await nodes_available()
    logger.debug(api.registry.categories)

    node_list = []
    for node, sub in api.registry.nodes.values():
        node_dict = {
            "schemaId": node.schema_id,
            "name": node.name,
            "category": sub.category.id,
            "nodeGroup": sub.id,
            "inputs": [x.to_dict() for x in node.inputs],
            "outputs": [x.to_dict() for x in node.outputs],
            "groupLayout": [
                g.to_dict() if isinstance(g, Group) else g for g in node.group_layout
            ],
            "iteratorInputs": [x.to_dict() for x in node.iterator_inputs],
            "iteratorOutputs": [x.to_dict() for x in node.iterator_outputs],
            "keyInfo": node.key_info.to_dict() if node.key_info else None,
            "description": node.description,
            "seeAlso": node.see_also,
            "icon": node.icon,
            "kind": node.kind,
            "hasSideEffects": node.side_effects,
            "deprecated": node.deprecated,
            "features": node.features,
        }
        node_list.append(node_dict)

    return json(
        {
            "nodes": node_list,
            "categories": [x.to_dict() for x in api.registry.categories],
            "categoriesMissingNodes": [],
        }
    )


class RunRequest(TypedDict):
    data: list[JsonNode]
    options: JsonExecutionOptions
    sendBroadcastData: bool


@app.route("/run", methods=["POST"])
async def run(request: Request):
    """Runs the provided nodes"""
    await nodes_available()
    ctx = AppContext.get(request.app)

    if ctx.executor:
        message = "Cannot run another executor while the first one is still running."
        logger.warning(message)
        return json(already_running_response(message), status=500)

    executor_id = ExecutionId("main-executor " + uuid.uuid4().hex)

    tracer = None
    try:
        if ctx.config.trace:
            logger.info("Starting VizTracer...")
            from viztracer import VizTracer

            tracer = VizTracer()
            tracer.log_async = True
            tracer.start()

        # wait until all previews are done
        await run_individual_counter.wait_zero()

        full_data: RunRequest = dict(request.json)  # type: ignore
        logger.debug(full_data)
        chain = parse_json(full_data["data"])
        optimize(chain)

        logger.info("Running new executor...")
        executor = Executor(
            id=executor_id,
            chain=chain,
            send_broadcast_data=full_data["sendBroadcastData"],
            options=ExecutionOptions.parse(full_data["options"]),
            loop=app.loop,
            queue=ctx.queue,
            pool=ctx.pool,
            storage_dir=ctx.storage_dir,
            parent_cache=OutputCache(static_data=ctx.cache.copy()),
        )
        try:
            ctx.executor = executor
            await executor.run()
        except Aborted:
            pass
        finally:
            ctx.executor = None
            gc.collect()

        return json(success_response(), status=200)
    except Exception as exception:
        logger.error(exception)
        if (
            isinstance(exception, NodeExecutionError)
            and exception.__cause__ is not None
        ):
            trace = "".join(
                traceback.format_exception(
                    type(exception.__cause__),
                    exception.__cause__,
                    exception.__cause__.__traceback__,
                )
            )
        else:
            trace = traceback.format_exc()
        logger.error(trace)

        error: ExecutionErrorData = {
            "message": "Error running nodes!",
            "source": None,
            "exception": str(exception),
            "exceptionTrace": trace,
        }
        if isinstance(exception, NodeExecutionError):
            error["source"] = {
                "nodeId": exception.node_id,
                "schemaId": exception.node_data.schema_id,
                "inputs": exception.inputs,
            }

        ctx.queue.put({"event": "execution-error", "data": error})
        return json(error_response("Error running nodes!", exception), status=500)
    finally:
        if ctx.config.trace and tracer is not None:
            logger.info("Stopping VizTracer...")
            tracer.stop()
            tracer.save(f"../traces/trace_{executor_id}.json")


class RunIndividualRequest(TypedDict):
    id: NodeId
    inputs: list[object]
    schemaId: str
    options: JsonExecutionOptions


@app.route("/run/individual", methods=["POST"])
async def run_individual(request: Request):
    """Runs a single node"""
    await nodes_available()
    ctx = AppContext.get(request.app)
    try:
        full_data: RunIndividualRequest = dict(request.json)  # type: ignore
        logger.debug(full_data)

        node_id = full_data["id"]
        ctx.cache.pop(node_id, None)

        node = FunctionNode(node_id, full_data["schemaId"])
        chain = Chain()
        chain.add_node(node)

        for index, i in enumerate(full_data["inputs"]):
            chain.inputs.set(node_id, node.data.inputs[index].id, i)

        # only yield certain types of events
        queue = EventConsumer.filter(
            ctx.queue, {"node-finish", "node-broadcast", "execution-error"}
        )

        execution_id = ExecutionId("individual-executor " + node_id)
        executor = Executor(
            id=execution_id,
            chain=chain,
            send_broadcast_data=True,
            options=ExecutionOptions.parse(full_data["options"]),
            loop=app.loop,
            queue=queue,
            storage_dir=ctx.storage_dir,
            pool=ctx.pool,
        )

        with run_individual_counter:
            try:
                if execution_id in ctx.individual_executors:
                    # kill the previous executor (if any)
                    old_executor = ctx.individual_executors[execution_id]
                    old_executor.kill()

                ctx.individual_executors[execution_id] = executor
                output = await executor.process_regular_node(node)
                ctx.cache[node_id] = output
            except Aborted:
                pass
            finally:
                if ctx.individual_executors.get(execution_id, None) == executor:
                    ctx.individual_executors.pop(execution_id, None)
                gc.collect()

        return json({"success": True, "data": None})
    except Exception as exception:
        logger.error(exception, exc_info=True)
        return json({"success": False, "error": str(exception)})


@app.route("/clear-cache/individual", methods=["POST"])
async def clear_cache_individual(request: Request):
    await nodes_available()
    ctx = AppContext.get(request.app)
    try:
        full_data = dict(request.json)  # type: ignore
        if ctx.cache.get(full_data["id"], None) is not None:
            del ctx.cache[full_data["id"]]
        return json({"success": True, "data": None})
    except Exception as exception:
        logger.error(exception, exc_info=True)
        return json({"success": False, "error": str(exception)})


@app.route("/pause", methods=["POST"])
async def pause(request: Request):
    """Pauses the current execution"""
    await nodes_available()
    ctx = AppContext.get(request.app)

    logger.info("Attempting to pause executor...")

    if not ctx.executor:
        logger.warning("No executor to pause.")
        return json(no_executor_response(), status=400)

    try:
        ctx.executor.pause()
        logger.info("Paused executor.")
        return json(success_response(), status=200)
    except Exception as exception:
        logger.log(2, exception, exc_info=True)
        return json(error_response("Error pausing execution!", exception), status=500)


@app.route("/resume", methods=["POST"])
async def resume(request: Request):
    """Pauses the current execution"""
    await nodes_available()
    ctx = AppContext.get(request.app)

    logger.info("Attempting to resume executor...")

    if not ctx.executor:
        logger.warning("No executor to resume.")
        return json(no_executor_response(), status=400)

    try:
        ctx.executor.resume()
        logger.info("Resumed executor.")
        return json(success_response(), status=200)
    except Exception as exception:
        logger.log(2, exception, exc_info=True)
        return json(error_response("Error resuming execution!", exception), status=500)


@app.route("/kill", methods=["POST"])
async def kill(request: Request):
    """Kills the current execution"""
    await nodes_available()
    ctx = AppContext.get(request.app)

    logger.info("Attempting to kill executor...")

    if not ctx.executor:
        logger.warning("No executor to kill.")
        return json(no_executor_response(), status=400)

    try:
        ctx.executor.kill()
        while ctx.executor:
            await asyncio.sleep(0.0001)
        logger.info("Killed executor.")
        return json(success_response(), status=200)
    except Exception as exception:
        logger.log(2, exception, exc_info=True)
        return json(error_response("Error killing execution!", exception), status=500)


@app.route("/packages", methods=["GET"])
async def get_packages(request: Request):
    await nodes_available()

    hide_internal = request.args.get("hideInternal", "true") == "true"

    packages = []
    for package in api.registry.packages.values():
        if package.name == "chaiNNer_standard" and hide_internal:
            continue

        pkg_dependencies = []
        for pkg_dep in package.dependencies:
            installed_version = installed_packages.get(pkg_dep.pypi_name, None)
            pkg_dep_item = {
                **pkg_dep.to_dict(),
            }
            if installed_version is None:
                pkg_dep_item["installed"] = None
            else:
                pkg_dep_item["installed"] = installed_version
            pkg_dependencies.append(pkg_dep_item)

        packages.append(package.to_dict())

    return json(packages)


@app.route("/features")
async def get_features(_request: Request):
    await nodes_available()

    features: list[tuple[api.Feature, api.Package]] = []
    for package in api.registry.packages.values():
        for feature in package.features:
            features.append((feature, package))

    # check all features in parallel
    async def check(feature: api.Feature) -> api.FeatureState | None:
        if feature.behavior is None:
            # no behavior assigned
            return None

        try:
            return await feature.behavior.check()
        except Exception as e:
            return api.FeatureState.disabled(str(e))

    # because good API design just isn't pythonic, asyncio.gather will return List[Any].
    results: list[api.FeatureState | None] = await asyncio.gather(
        *[check(f) for f, _ in features]
    )

    features_json = []
    for (feature, package), state in zip(features, results):
        if state is None:
            continue

        features_json.append(
            {
                "packageId": package.id,
                "featureId": feature.id,
                "enabled": state.is_enabled,
                "details": state.details,
            }
        )

    return json(features_json)


@app.get("/sse")
async def sse(request: Request):
    ctx = AppContext.get(request.app)
    headers = {"Cache-Control": "no-cache"}
    response = await request.respond(headers=headers, content_type="text/event-stream")
    if response is None:
        return

    while True:
        message = await ctx.queue.get()
        await response.send(
            f"event: {message['event']}\n" f"data: {stringify(message['data'])}\n\n"
        )


async def import_packages(
    config: ServerConfig,
):
    importlib.import_module("packages.chaiNNer_standard")
    importlib.import_module("packages.chaiNNer_pytorch")
    importlib.import_module("packages.chaiNNer_ncnn")
    importlib.import_module("packages.chaiNNer_onnx")
    importlib.import_module("packages.chaiNNer_external")

    logger.info("Loading Nodes...")

    load_errors = api.registry.load_nodes(__file__)
    if len(load_errors) > 0:
        import_errors: list[api.LoadErrorInfo] = []
        for e in load_errors:
            if not isinstance(e.error, ModuleNotFoundError):
                logger.warning(
                    f"Failed to load {e.module} ({e.file}):", exc_info=e.error
                )
            else:
                import_errors.append(e)

        if len(import_errors) > 0:
            logger.warning(f"Failed to import {len(import_errors)} modules:")

            by_error: dict[str, list[api.LoadErrorInfo]] = {}
            for e in import_errors:
                key = str(e.error)
                if key not in by_error:
                    by_error[key] = []
                by_error[key].append(e)

            for error in sorted(by_error.keys()):
                modules = [e.module for e in by_error[error]]
                if len(modules) == 1:
                    logger.warning(f"{error}  ->  {modules[0]}")
                else:
                    count = len(modules)
                    if count > 3:
                        modules = modules[:2] + [f"and {count - 2} more ..."]
                    l = "\n".join("  ->  " + m for m in modules)
                    logger.warning(f"{error}  ->  {count} modules ...\n{l}")

        if config.error_on_failed_node:
            raise ValueError("Error importing nodes")


async def setup(sanic_app: Sanic):
    await import_packages(AppContext.get(sanic_app).config)


exit_code = 0


async def close_server(sanic_app: Sanic):
    # pylint: disable=global-statement
    global exit_code

    try:
        await nodes_available()
    except Exception as ex:
        logger.error(f"Error waiting for server to start: {ex}")
        exit_code = 1

    # now we can close the server
    logger.info("Closing server...")
    sanic_app.stop()


@app.after_server_start
async def after_server_start(sanic_app: Sanic, loop: asyncio.AbstractEventLoop):
    # pylint: disable=global-statement
    global setup_task
    ctx = AppContext.get(sanic_app)

    # start the setup task
    setup_task = loop.create_task(setup(sanic_app))

    # start task to close the server
    if ctx.config.close_after_start:
        loop.create_task(close_server(sanic_app))


def main():
    config = AppContext.get(app).config
    app.run(port=config.port, single_process=True)
    if exit_code != 0:
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
