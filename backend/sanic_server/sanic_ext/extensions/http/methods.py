from functools import partial
from inspect import isawaitable
from typing import Sequence, Union

from sanic import Sanic
from sanic.constants import HTTPMethod
from sanic.exceptions import SanicException
from sanic.response import empty, raw

from ...utils.route import clean_route_name
from ..openapi import openapi


def add_http_methods(
    app: Sanic, methods: Sequence[Union[str, HTTPMethod]]
) -> None:
    """
    Adds HTTP methods to an app

    :param app: Your Sanic app
    :type app: Sanic
    :param methods: The http methods being added, eg: CONNECT, TRACE
    :type methods: Sequence[str]
    """

    app.router.ALLOWED_METHODS = tuple(
        [*app.router.ALLOWED_METHODS, *methods]  # type: ignore
    )


def add_auto_handlers(
    app: Sanic, auto_head: bool, auto_options: bool, auto_trace: bool
) -> None:
    if auto_trace and "TRACE" not in app.router.ALLOWED_METHODS:
        raise SanicException(
            "Cannot use apply(..., auto_trace=True) if TRACE is not an "
            "allowed HTTP method. Make sure apply(..., all_http_methods=True) "
            "has been set."
        )

    async def head_handler(request, get_handler, *args, **kwargs):
        retval = get_handler(request, *args, **kwargs)
        if isawaitable(retval):
            retval = await retval
        return retval

    async def options_handler(request, methods, *args, **kwargs):
        resp = empty()
        resp.headers["allow"] = ",".join([*methods, "OPTIONS"])
        return resp

    async def trace_handler(request):
        cleaned_head = b""
        for line in request.head.split(b"\r\n"):
            first_word, _ = line.split(b" ", 1)

            if (
                first_word.lower().replace(b":", b"").decode("utf-8")
                not in request.app.config.TRACE_EXCLUDED_HEADERS
            ):
                cleaned_head += line + b"\r\n"

        message = "\r\n\r\n".join(
            [part.decode("utf-8") for part in [cleaned_head, request.body]]
        )
        return raw(message, content_type="message/http")

    @app.before_server_start
    def _add_handlers(app, _):
        nonlocal auto_head
        nonlocal auto_options

        if auto_head:
            app.router.reset()
            for group in app.router.groups.values():
                if "GET" in group.methods and "HEAD" not in group.methods:
                    get_route = group.methods_index["GET"]
                    name = f"{get_route.name}_head"
                    app.add_route(
                        handler=openapi.definition(
                            summary=clean_route_name(get_route.name).title(),
                            description="Retrieve HEAD details",
                        )(
                            partial(
                                head_handler, get_handler=get_route.handler
                            )
                        ),
                        uri=group.uri,
                        methods=["HEAD"],
                        strict_slashes=group.strict,
                        name=name,
                    )
            app.router.finalize()

        if auto_trace:
            app.router.reset()
            for group in app.router.groups.values():
                if "TRACE" not in group.methods:
                    app.add_route(
                        handler=trace_handler,
                        uri=group.uri,
                        methods=["TRACE"],
                        strict_slashes=group.strict,
                    )
            app.router.finalize()

        if auto_options:
            app.router.reset()
            for group in app.router.groups.values():
                if "OPTIONS" not in group.methods:
                    app.add_route(
                        handler=partial(
                            options_handler, methods=group.methods
                        ),
                        uri=group.uri,
                        methods=["OPTIONS"],
                        strict_slashes=group.strict,
                        name="_options",
                    )
            app.router.finalize()
