# -*- coding: utf-8 -*-
"""
    extension
    ~~~~
    Sanic-CORS is a simple extension to Sanic allowing you to support cross
    origin resource sharing (CORS) using a simple decorator.

    :copyright: (c) 2021 by Ashley Sommer (based on flask-cors by Cory Dolphin).
    :license: MIT, see LICENSE for more details.
"""
import logging
from asyncio import iscoroutinefunction
from distutils.version import LooseVersion
from functools import partial, update_wrapper
from inspect import isawaitable

from ..sanic import __version__ as sanic_version
from ..sanic import exceptions, response
from ..sanic.exceptions import MethodNotSupported, NotFound
from ..sanic.handlers import ErrorHandler
from ..sanic_plugin_toolkit import SanicPlugin
from .core import *

SANIC_VERSION = LooseVersion(sanic_version)
SANIC_18_12_0 = LooseVersion("18.12.0")
SANIC_19_9_0 = LooseVersion("19.9.0")
SANIC_19_12_0 = LooseVersion("19.12.0")
SANIC_21_9_0 = LooseVersion("21.9.0")


USE_ASYNC_EXCEPTION_HANDLER = False


class CORS(SanicPlugin):
    __slots__ = tuple()
    """
    Initializes Cross Origin Resource sharing for the application. The
    arguments are identical to :py:func:`cross_origin`, with the addition of a
    `resources` parameter. The resources parameter defines a series of regular
    expressions for resource paths to match and optionally, the associated
    options to be applied to the particular resource. These options are
    identical to the arguments to :py:func:`cross_origin`.

    The settings for CORS are determined in the following order

    1. Resource level settings (e.g when passed as a dictionary)
    2. Keyword argument settings
    3. App level configuration settings (e.g. CORS_*)
    4. Default settings

    Note: as it is possible for multiple regular expressions to match a
    resource path, the regular expressions are first sorted by length,
    from longest to shortest, in order to attempt to match the most
    specific regular expression. This allows the definition of a
    number of specific resource options, with a wildcard fallback
    for all other resources.

    :param resources:
        The series of regular expression and (optionally) associated CORS
        options to be applied to the given resource path.

        If the argument is a dictionary, it's keys must be regular expressions,
        and the values must be a dictionary of kwargs, identical to the kwargs
        of this function.

        If the argument is a list, it is expected to be a list of regular
        expressions, for which the app-wide configured options are applied.

        If the argument is a string, it is expected to be a regular expression
        for which the app-wide configured options are applied.

        Default : Match all and apply app-level configuration

    :type resources: dict, iterable or string

    :param origins:
        The origin, or list of origins to allow requests from.
        The origin(s) may be regular expressions, case-sensitive strings,
        or else an asterisk

        Default : '*'
    :type origins: list, string or regex

    :param methods:
        The method or list of methods which the allowed origins are allowed to
        access for non-simple requests.

        Default : [GET, HEAD, POST, OPTIONS, PUT, PATCH, DELETE]
    :type methods: list or string

    :param expose_headers:
        The header or list which are safe to expose to the API of a CORS API
        specification.

        Default : None
    :type expose_headers: list or string

    :param allow_headers:
        The header or list of header field names which can be used when this
        resource is accessed by allowed origins. The header(s) may be regular
        expressions, case-sensitive strings, or else an asterisk.

        Default : '*', allow all headers
    :type allow_headers: list, string or regex

    :param supports_credentials:
        Allows users to make authenticated requests. If true, injects the
        `Access-Control-Allow-Credentials` header in responses. This allows
        cookies and credentials to be submitted across domains.

        :note: This option cannot be used in conjuction with a '*' origin

        Default : False
    :type supports_credentials: bool

    :param max_age:
        The maximum time for which this CORS request maybe cached. This value
        is set as the `Access-Control-Max-Age` header.

        Default : None
    :type max_age: timedelta, integer, string or None

    :param send_wildcard: If True, and the origins parameter is `*`, a wildcard
        `Access-Control-Allow-Origin` header is sent, rather than the
        request's `Origin` header.

        Default : False
    :type send_wildcard: bool

    :param vary_header:
        If True, the header Vary: Origin will be returned as per the W3
        implementation guidelines.

        Setting this header when the `Access-Control-Allow-Origin` is
        dynamically generated (e.g. when there is more than one allowed
        origin, and an Origin than '*' is returned) informs CDNs and other
        caches that the CORS headers are dynamic, and cannot be cached.

        If False, the Vary header will never be injected or altered.

        Default : True
    :type vary_header: bool
    """

    def __init__(self, *args, **kwargs):
        if SANIC_18_12_0 > SANIC_VERSION:
            raise RuntimeError(
                "You cannot use this version of Sanic-CORS with "
                "Sanic earlier than v18.12.0"
            )
        super(CORS, self).__init__(*args, **kwargs)

    def on_before_registered(self, context, *args, **kwargs):
        context._options = kwargs
        if not CORS.on_before_registered.has_run:
            # debug = partial(context.log, logging.DEBUG)
            _ = _make_cors_request_middleware_function(self)
            _ = _make_cors_response_middleware_function(self)
            CORS.on_before_registered.has_run = True

    on_before_registered.has_run = False

    def on_registered(self, context, *args, **kwargs):
        # this will need to be called more than once, for every app it is registered on.
        self.init_app(context, *args, **kwargs)

    def init_app(self, context, *args, **kwargs):
        app = context.app
        log = context.log
        _options = context._options
        debug = partial(log, logging.DEBUG)
        # The resources and options may be specified in the App Config, the CORS constructor
        # or the kwargs to the call to init_app.
        options = get_cors_options(app, _options, kwargs)

        # Flatten our resources into a list of the form
        # (pattern_or_regexp, dictionary_of_options)
        resources = parse_resources(options.get("resources"))

        # Compute the options for each resource by combining the options from
        # the app's configuration, the constructor, the kwargs to init_app, and
        # finally the options specified in the resources dictionary.
        resources = [
            (pattern, get_cors_options(app, options, opts))
            for (pattern, opts) in resources
        ]
        context.options = options
        context.resources = resources
        # Create a human readable form of these resources by converting the compiled
        # regular expressions into strings.
        resources_human = dict(
            [(get_regexp_pattern(pattern), opts) for (pattern, opts) in resources]
        )
        debug("Configuring CORS with resources: {}".format(resources_human))
        if hasattr(app, "error_handler"):
            cors_error_handler = CORSErrorHandler(
                context, app.error_handler, fallback="auto"
            )
            setattr(app, "error_handler", cors_error_handler)
        else:
            # Blueprints have no error_handler. Just skip error_handler initialisation
            pass

    async def route_wrapper(
        self,
        route,
        req,
        context,
        request_args,
        request_kw,
        *decorator_args,
        **decorator_kw
    ):
        _ = decorator_kw.pop("with_context")  # ignore this.
        _options = decorator_kw
        options = get_cors_options(context.app, _options)
        if options.get("automatic_options", True) and req.method == "OPTIONS":
            resp = response.HTTPResponse()
        else:
            resp = route(req, *request_args, **request_kw)
            while isawaitable(resp):
                resp = await resp
            # resp can be `None` or `[]` if using Websockets
            if not resp:
                return None
        try:
            request_context = context.request[id(req)]
        except (AttributeError, LookupError):
            if SANIC_19_9_0 <= SANIC_VERSION:
                request_context = req.ctx
            else:
                request_context = None
        set_cors_headers(req, resp, request_context, options)
        if request_context is not None:
            setattr(request_context, SANIC_CORS_EVALUATED, "1")
        else:
            context.log(
                logging.DEBUG,
                "Cannot access a sanic request "
                "context. Has request started? Is request ended?",
            )
        return resp


def unapplied_cors_request_middleware(req, context):
    if req.method == "OPTIONS":
        try:
            path = req.path
        except AttributeError:
            path = req.url
        resources = context.resources
        log = context.log
        debug = partial(log, logging.DEBUG)
        for res_regex, res_options in resources:
            if res_options.get("automatic_options", True) and try_match(
                path, res_regex
            ):
                debug(
                    "Request to '{:s}' matches CORS resource '{}'. "
                    "Using options: {}".format(
                        path, get_regexp_pattern(res_regex), res_options
                    )
                )
                resp = response.HTTPResponse()

                try:
                    request_context = context.request[id(req)]
                except (AttributeError, LookupError):
                    if SANIC_19_9_0 <= SANIC_VERSION:
                        request_context = req.ctx
                    else:
                        request_context = None
                        context.log(
                            logging.DEBUG,
                            "Cannot access a sanic request "
                            "context. Has request started? Is request ended?",
                        )
                set_cors_headers(req, resp, request_context, res_options)
                if request_context is not None:
                    setattr(request_context, SANIC_CORS_EVALUATED, "1")
                return resp
        else:
            debug("No CORS rule matches")


async def unapplied_cors_response_middleware(req, resp, context):
    log = context.log
    debug = partial(log, logging.DEBUG)
    # `resp` can be None or [] in the case of using Websockets
    if not resp:
        return False
    try:
        request_context = context.request[id(req)]
    except (AttributeError, LookupError):
        if SANIC_19_9_0 <= SANIC_VERSION:
            request_context = req.ctx
        else:
            debug(
                "Cannot find the request context. "
                "Is request already finished? Is request not started?"
            )
            request_context = None
    if request_context is not None:
        # If CORS headers are set in the CORS error handler
        if getattr(request_context, SANIC_CORS_SKIP_RESPONSE_MIDDLEWARE, False):
            debug("CORS was handled in the exception handler, skipping")
            return False

        # If CORS headers are set in a view decorator, pass
        elif getattr(request_context, SANIC_CORS_EVALUATED, False):
            debug("CORS have been already evaluated, skipping")
            return False
    try:
        path = req.path
    except AttributeError:
        path = req.url

    resources = context.resources
    for res_regex, res_options in resources:
        if try_match(path, res_regex):
            debug(
                "Request to '{}' matches CORS resource '{:s}'. Using options: {}".format(
                    path, get_regexp_pattern(res_regex), res_options
                )
            )
            set_cors_headers(req, resp, request_context, res_options)
            if request_context is not None:
                setattr(request_context, SANIC_CORS_EVALUATED, "1")
            break
    else:
        debug("No CORS rule matches")


def _make_cors_request_middleware_function(plugin):
    applied_cors_request_middleware = plugin.middleware(
        relative="pre", attach_to="request", with_context=True
    )(unapplied_cors_request_middleware)
    return applied_cors_request_middleware


def _make_cors_response_middleware_function(plugin):
    applied_cors_response_middleware = plugin.middleware(
        relative="post", attach_to="response", with_context=True
    )(unapplied_cors_response_middleware)
    return applied_cors_response_middleware


class CORSErrorHandler(ErrorHandler):
    @classmethod
    def _apply_cors_to_exception(cls, ctx, req, resp):
        try:
            path = req.path
        except AttributeError:
            path = req.url
        if path is not None:
            resources = ctx.resources
            log = ctx.log
            debug = partial(log, logging.DEBUG)
            try:
                request_context = ctx.request[id(req)]
            except (AttributeError, LookupError):
                if SANIC_19_9_0 <= SANIC_VERSION:
                    request_context = req.ctx
                else:
                    request_context = None
            for res_regex, res_options in resources:
                if try_match(path, res_regex):
                    debug(
                        "Request to '{:s}' matches CORS resource '{}'. "
                        "Using options: {}".format(
                            path, get_regexp_pattern(res_regex), res_options
                        )
                    )
                    set_cors_headers(req, resp, request_context, res_options)
                    break
            else:
                debug("No CORS rule matches")
        else:
            pass

    def __new__(cls, *args, **kwargs):
        self = super(CORSErrorHandler, cls).__new__(cls)
        if USE_ASYNC_EXCEPTION_HANDLER:
            self.response = self.async_response
        else:
            self.response = self.sync_response
        return self

    def __init__(self, context, orig_handler, fallback="auto"):
        if SANIC_21_9_0 <= SANIC_VERSION:
            super(CORSErrorHandler, self).__init__(fallback=fallback)
        else:
            super(CORSErrorHandler, self).__init__()
        self.orig_handler = orig_handler
        self.ctx = context

    if SANIC_21_9_0 <= SANIC_VERSION:

        def add(self, exception, handler, route_names=None):
            self.orig_handler.add(exception, handler, route_names=route_names)

        def lookup(self, exception, route_name=None):
            return self.orig_handler.lookup(exception, route_name=route_name)

    else:

        def add(self, exception, handler):
            self.orig_handler.add(exception, handler)

        def lookup(self, exception):
            return self.orig_handler.lookup(exception)

    # wrap app's original exception response function
    # so that error responses have proper CORS headers
    @classmethod
    def wrapper(cls, f, ctx, req, e):
        opts = ctx.options
        log = ctx.log
        # get response from the original handler
        if (
            req is not None
            and SANIC_19_12_0 <= SANIC_VERSION
            and isinstance(e, MethodNotSupported)
            and req.method == "OPTIONS"
            and opts.get("automatic_options", True)
        ):
            # A very specific set of requirments to trigger this kind of
            # automatic-options resp
            resp = response.HTTPResponse()
        else:
            do_await = iscoroutinefunction(f)
            resp = f(req, e)
            if do_await:
                log(
                    logging.DEBUG,
                    "Found an async Exception handler response. "
                    "Cannot apply CORS to it. Passing it on.",
                )
                return resp
        # SanicExceptions are equiv to Flask Aborts,
        # always apply CORS to them.
        if (req is not None and resp is not None) and (
            isinstance(e, exceptions.SanicException)
            or opts.get("intercept_exceptions", True)
        ):
            try:
                cls._apply_cors_to_exception(ctx, req, resp)
            except AttributeError:
                # not sure why certain exceptions doesn't have
                # an accompanying request
                pass
        if req is None:
            return resp
        # These exceptions have normal CORS middleware applied automatically.
        # So set a flag to skip our manual application of the middleware.
        try:
            request_context = ctx.request[id(req)]
        except (LookupError, AttributeError):
            # On Sanic 19.12.0, a NotFound error can be thrown _before_
            # the request_context is set up. This is a fallback routine:
            if SANIC_19_12_0 <= SANIC_VERSION and isinstance(
                e, (NotFound, MethodNotSupported)
            ):
                # On sanic 19.9.0+ request is a dict, so we can add our
                # flag directly to it.
                request_context = req.ctx
            else:
                log(
                    logging.DEBUG,
                    "Cannot find the request context. Is request started? "
                    "Is request already finished?",
                )
                request_context = None
        if request_context is not None:
            setattr(request_context, SANIC_CORS_SKIP_RESPONSE_MIDDLEWARE, "1")
        return resp

    async def async_response(self, request, exception):
        orig_resp_handler = self.orig_handler.response
        return await self.wrapper(orig_resp_handler, self.ctx, request, exception)

    def sync_response(self, request, exception):
        orig_resp_handler = self.orig_handler.response
        return self.wrapper(orig_resp_handler, self.ctx, request, exception)


instance = cors = CORS()
__all__ = ["cors", "CORS"]
