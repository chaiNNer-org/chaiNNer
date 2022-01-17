# -*- coding: utf-8 -*-
import importlib
from collections import defaultdict, deque, namedtuple
from distutils.version import LooseVersion
from functools import update_wrapper
from inspect import isawaitable
from typing import Type

from ..sanic import Blueprint, Sanic
from ..sanic import __version__ as sanic_version

SANIC_VERSION = LooseVersion(sanic_version)
SANIC_21_6_0 = LooseVersion("21.6.0")
SANIC_21_9_0 = LooseVersion("21.9.0")

CRITICAL = 50
ERROR = 40
WARNING = 30
INFO = 20
DEBUG = 10

FutureMiddleware = namedtuple("FutureMiddleware", ["middleware", "args", "kwargs"])
FutureRoute = namedtuple("FutureRoute", ["handler", "uri", "args", "kwargs"])
FutureWebsocket = namedtuple("FutureWebsocket", ["handler", "uri", "args", "kwargs"])
FutureStatic = namedtuple("FutureStatic", ["uri", "file_or_dir", "args", "kwargs"])
FutureException = namedtuple("FutureException", ["handler", "exceptions", "kwargs"])
PluginRegistration = namedtuple(
    "PluginRegistration", ["realm", "plugin_name", "url_prefix"]
)
PluginAssociated = namedtuple("PluginAssociated", ["plugin", "reg"])


class SanicPlugin(object):
    __slots__ = (
        "registrations",
        "_routes",
        "_ws",
        "_static",
        "_middlewares",
        "_exceptions",
        "_listeners",
        "_initialized",
        "__weakref__",
    )

    AssociatedTuple: Type[object] = PluginAssociated

    # Decorator
    def middleware(self, *args, **kwargs):
        """Decorate and register middleware
        :param args: captures all of the positional arguments passed in
        :type args: tuple(Any)
        :param kwargs: captures the keyword arguments passed in
        :type kwargs: dict(Any)
        :return: The middleware function to use as the decorator
        :rtype: fn
        """
        kwargs.setdefault("priority", 5)
        kwargs.setdefault("relative", None)
        kwargs.setdefault("attach_to", None)
        kwargs.setdefault("with_context", False)
        if len(args) == 1 and callable(args[0]):
            middle_f = args[0]
            self._middlewares.append(
                FutureMiddleware(middle_f, args=tuple(), kwargs=kwargs)
            )
            return middle_f

        def wrapper(middleware_f):
            self._middlewares.append(
                FutureMiddleware(middleware_f, args=args, kwargs=kwargs)
            )
            return middleware_f

        return wrapper

    def exception(self, *args, **kwargs):
        """Decorate and register an exception handler
        :param args: captures all of the positional arguments passed in
        :type args: tuple(Any)
        :param kwargs: captures the keyword arguments passed in
        :type kwargs: dict(Any)
        :return: The exception function to use as the decorator
        :rtype: fn
        """
        if len(args) == 1 and callable(args[0]):
            if isinstance(args[0], type) and issubclass(args[0], Exception):
                pass
            else:  # pragma: no cover
                raise RuntimeError(
                    "Cannot use the @exception decorator without arguments"
                )

        def wrapper(handler_f):
            self._exceptions.append(
                FutureException(handler_f, exceptions=args, kwargs=kwargs)
            )
            return handler_f

        return wrapper

    def listener(self, event, *args, **kwargs):
        """Create a listener from a decorated function.
        :param event: Event to listen to.
        :type event: str
        :param args: captures all of the positional arguments passed in
        :type args: tuple(Any)
        :param kwargs: captures the keyword arguments passed in
        :type kwargs: dict(Any)
        :return: The function to use as the listener
        :rtype: fn
        """
        if len(args) == 1 and callable(args[0]):  # pragma: no cover
            raise RuntimeError("Cannot use the @listener decorator without arguments")

        def wrapper(listener_f):
            if len(kwargs) > 0:
                listener_f = (listener_f, kwargs)
            self._listeners[event].append(listener_f)
            return listener_f

        return wrapper

    def route(self, uri, *args, **kwargs):
        """Create a plugin route from a decorated function.
        :param uri: endpoint at which the route will be accessible.
        :type uri: str
        :param args: captures all of the positional arguments passed in
        :type args: tuple(Any)
        :param kwargs: captures the keyword arguments passed in
        :type kwargs: dict(Any)
        :return: The function to use as the decorator
        :rtype: fn
        """
        if len(args) == 0 and callable(uri):  # pragma: no cover
            raise RuntimeError("Cannot use the @route decorator without arguments.")
        kwargs.setdefault("methods", frozenset({"GET"}))
        kwargs.setdefault("host", None)
        kwargs.setdefault("strict_slashes", False)
        kwargs.setdefault("stream", False)
        kwargs.setdefault("name", None)
        kwargs.setdefault("version", None)
        kwargs.setdefault("ignore_body", False)
        kwargs.setdefault("websocket", False)
        kwargs.setdefault("subprotocols", None)
        kwargs.setdefault("unquote", False)
        kwargs.setdefault("static", False)
        if SANIC_21_6_0 <= SANIC_VERSION:
            kwargs.setdefault("version_prefix", "/v")
        if SANIC_21_9_0 <= SANIC_VERSION:
            kwargs.setdefault("error_format", None)

        def wrapper(handler_f):
            self._routes.append(FutureRoute(handler_f, uri, args, kwargs))
            return handler_f

        return wrapper

    def websocket(self, uri, *args, **kwargs):
        """Create a websocket route from a decorated function
        deprecated. now use @route("/path",websocket=True)
        """
        kwargs["websocket"] = True
        return self.route(uri, *args, **kwargs)

    def static(self, uri, file_or_directory, *args, **kwargs):
        """Create a websocket route from a decorated function
        :param uri: endpoint at which the socket endpoint will be accessible.
        :type uri: str
        :param args: captures all of the positional arguments passed in
        :type args: tuple(Any)
        :param kwargs: captures the keyword arguments passed in
        :type kwargs: dict(Any)
        :return: The function to use as the decorator
        :rtype: fn
        """

        kwargs.setdefault("pattern", r"/?.+")
        kwargs.setdefault("use_modified_since", True)
        kwargs.setdefault("use_content_range", False)
        kwargs.setdefault("stream_large_files", False)
        kwargs.setdefault("name", "static")
        kwargs.setdefault("host", None)
        kwargs.setdefault("strict_slashes", None)
        kwargs.setdefault("content_type", None)

        self._static.append(FutureStatic(uri, file_or_directory, args, kwargs))

    def on_before_registered(self, context, *args, **kwargs):
        pass

    def on_registered(self, context, reg, *args, **kwargs):
        pass

    def find_plugin_registration(self, realm):
        if isinstance(realm, PluginRegistration):
            return realm
        for reg in self.registrations:
            (r, n, u) = reg
            if r is not None and r == realm:
                return reg
        raise KeyError("Plugin registration not found")

    def first_plugin_context(self):
        """Returns the context is associated with the first app this plugin was
        registered on"""
        # Note, because registrations are stored in a set, its not _really_
        # the first one, but whichever one it sees first in the set.
        first_realm_reg = next(iter(self.registrations))
        return self.get_context_from_realm(first_realm_reg)

    def get_context_from_realm(self, realm):
        rt = RuntimeError("Cannot use the plugin's Context before it is registered.")
        if isinstance(realm, PluginRegistration):
            reg = realm
        else:
            try:
                reg = self.find_plugin_registration(realm)
            except LookupError:
                raise rt
        (r, n, u) = reg
        try:
            return r.get_context(n)
        except KeyError as k:
            raise k
        except AttributeError:
            raise rt

    def get_app_from_realm_context(self, realm):
        rt = RuntimeError(
            "Cannot get the app from Realm before this plugin is registered on the Realm."
        )
        if isinstance(realm, PluginRegistration):
            reg = realm
        else:
            try:
                reg = self.find_plugin_registration(realm)
            except LookupError:
                raise rt
        context = self.get_context_from_realm(reg)
        try:
            app = context.app
        except (LookupError, AttributeError):
            raise rt
        return app

    def resolve_url_for(self, realm, view_name, *args, **kwargs):
        try:
            reg = self.find_plugin_registration(realm)
        except LookupError:
            raise RuntimeError(
                "Cannot resolve URL because this plugin is not registered on the PluginRealm."
            )
        (realm, name, url_prefix) = reg
        app = self.get_app_from_realm_context(reg)
        if app is None:
            return None
        if isinstance(app, Blueprint):
            self.warning(
                "Cannot use url_for when plugin is registered on a Blueprint. Use `app.url_for` instead."
            )
            return None
        constructed_name = "{}.{}".format(name, view_name)
        return app.url_for(constructed_name, *args, **kwargs)

    def log(self, realm, level, message, *args, **kwargs):
        try:
            reg = self.find_plugin_registration(realm)
        except LookupError:
            raise RuntimeError(
                "Cannot log using this plugin, because this plugin is not registered on the Realm."
            )
        context = self.get_context_from_realm(reg)
        return context.log(level, message, *args, reg=self, **kwargs)

    def debug(self, message, *args, **kwargs):
        return self.log(DEBUG, message, *args, **kwargs)

    def info(self, message, *args, **kwargs):
        return self.log(INFO, message, *args, **kwargs)

    def warning(self, message, *args, **kwargs):
        return self.log(WARNING, message, *args, **kwargs)

    def error(self, message, *args, **kwargs):
        return self.log(ERROR, message, *args, **kwargs)

    def critical(self, message, *args, **kwargs):
        return self.log(CRITICAL, message, *args, **kwargs)

    @classmethod
    def decorate(cls, app, *args, run_middleware=False, with_context=False, **kwargs):
        """
        This is a decorator that can be used to apply this plugin to a specific
        route/view on your app, rather than the whole app.
        :param app:
        :type app: Sanic | Blueprint
        :param args:
        :type args: tuple(Any)
        :param run_middleware:
        :type run_middleware: bool
        :param with_context:
        :type with_context: bool
        :param kwargs:
        :param kwargs: dict(Any)
        :return: the decorated route/view
        :rtype: fn
        """
        from ..sanic_plugin_toolkit.realm import SanicPluginRealm

        realm = SanicPluginRealm(app)  # get the singleton from the app
        try:
            assoc = realm.register_plugin(cls, skip_reg=True)
        except ValueError as e:
            # this is normal, if this plugin has been registered previously
            assert e.args and len(e.args) > 1
            assoc = e.args[1]
        (plugin, reg) = assoc
        # plugin may not actually be registered
        inst = realm.get_plugin_inst(plugin)
        # registered might be True, False or None at this point
        regd = True if inst else None
        if regd is True:
            # middleware will be run on this route anyway, because the plugin
            # is registered on the app. Turn it off on the route-level.
            run_middleware = False
        req_middleware = deque()
        resp_middleware = deque()
        if run_middleware:
            for i, m in enumerate(plugin._middlewares):
                attach_to = m.kwargs.pop("attach_to", "request")
                priority = m.kwargs.pop("priority", 5)
                with_context = m.kwargs.pop("with_context", False)
                mw_handle_fn = m.middleware
                if attach_to == "response":
                    relative = m.kwargs.pop("relative", "post")
                    if relative == "pre":
                        mw = (
                            0,
                            0 - priority,
                            0 - i,
                            mw_handle_fn,
                            with_context,
                            m.args,
                            m.kwargs,
                        )
                    else:  # relative = "post"
                        mw = (
                            1,
                            0 - priority,
                            0 - i,
                            mw_handle_fn,
                            with_context,
                            m.args,
                            m.kwargs,
                        )
                    resp_middleware.append(mw)
                else:  # attach_to = "request"
                    relative = m.kwargs.pop("relative", "pre")
                    if relative == "post":
                        mw = (
                            1,
                            priority,
                            i,
                            mw_handle_fn,
                            with_context,
                            m.args,
                            m.kwargs,
                        )
                    else:  # relative = "pre"
                        mw = (
                            0,
                            priority,
                            i,
                            mw_handle_fn,
                            with_context,
                            m.args,
                            m.kwargs,
                        )
                    req_middleware.append(mw)

        req_middleware = tuple(sorted(req_middleware))
        resp_middleware = tuple(sorted(resp_middleware))

        def _decorator(f):
            nonlocal realm, plugin, regd, run_middleware, with_context
            nonlocal req_middleware, resp_middleware, args, kwargs

            async def wrapper(request, *a, **kw):
                nonlocal realm, plugin, regd, run_middleware, with_context
                nonlocal req_middleware, resp_middleware, f, args, kwargs
                # the plugin was not registered on the app, it might be now
                if regd is None:
                    _inst = realm.get_plugin_inst(plugin)
                    regd = _inst is not None

                context = plugin.get_context_from_realm(realm)
                if run_middleware and not regd and len(req_middleware) > 0:
                    for (
                        _a,
                        _p,
                        _i,
                        handler,
                        with_context,
                        args,
                        kwargs,
                    ) in req_middleware:
                        if with_context:
                            resp = handler(request, *args, context=context, **kwargs)
                        else:
                            resp = handler(request, *args, **kwargs)
                        if isawaitable(resp):
                            resp = await resp
                        if resp:
                            return

                response = await plugin.route_wrapper(
                    f,
                    request,
                    context,
                    a,
                    kw,
                    *args,
                    with_context=with_context,
                    **kwargs
                )
                if isawaitable(response):
                    response = await response
                if run_middleware and not regd and len(resp_middleware) > 0:
                    for (
                        _a,
                        _p,
                        _i,
                        handler,
                        with_context,
                        args,
                        kwargs,
                    ) in resp_middleware:
                        if with_context:
                            _resp = handler(
                                request, response, *args, context=context, **kwargs
                            )
                        else:
                            _resp = handler(request, response, *args, **kwargs)
                        if isawaitable(_resp):
                            _resp = await _resp
                        if _resp:
                            response = _resp
                            break
                return response

            return update_wrapper(wrapper, f)

        return _decorator

    async def route_wrapper(
        self,
        route,
        request,
        context,
        request_args,
        request_kw,
        *decorator_args,
        with_context=None,
        **decorator_kw
    ):
        """This is the function that is called when a route is decorated with
        your plugin decorator. Context will normally be None, but the user
        can pass use_context=True so the route will get the plugin
        context
        """
        # by default, do nothing, just run the wrapped function
        if with_context:
            resp = route(request, context, *request_args, **request_kw)
        else:
            resp = route(request, *request_args, **request_kw)
        if isawaitable(resp):
            resp = await resp
        return resp

    def __new__(cls, *args, **kwargs):
        # making a bold assumption here.
        # Assuming that if a sanic plugin is initialized using
        # `MyPlugin(app)`, then the user is attempting to do a legacy plugin
        # instantiation, aka Flask-Style plugin instantiation.
        if (
            args
            and len(args) > 0
            and (isinstance(args[0], Sanic) or isinstance(args[0], Blueprint))
        ):
            app = args[0]
            try:
                mod_name = cls.__module__
                mod = importlib.import_module(mod_name)
                assert mod
            except (ImportError, AssertionError):
                raise RuntimeError(
                    "Failed attempting a legacy plugin instantiation. "
                    "Cannot find the module this plugin belongs to."
                )
            # Get the sanic_plugin_toolkit singleton from this app
            from ..sanic_plugin_toolkit.realm import SanicPluginRealm

            realm = SanicPluginRealm(app)
            # catch cases like when the module is "__main__" or
            # "__call__" or "__init__"
            if mod_name.startswith("__"):
                # In this case, we cannot use the module to register the
                # plugin. Try to use the class method.
                assoc = realm.register_plugin(cls, *args, **kwargs)
            else:
                assoc = realm.register_plugin(mod, *args, **kwargs)
            return assoc
        self = super(SanicPlugin, cls).__new__(cls)
        try:
            self._initialized  # initialized may be True or Unknown
        except AttributeError:
            self._initialized = False
        return self

    def is_registered_in_realm(self, check_realm):
        for reg in self.registrations:
            (realm, name, url) = reg
            if realm is not None and realm == check_realm:
                return True
        return False

    def __init__(self, *args, **kwargs):
        # Sometimes __init__ can be called twice.
        # Ignore it on subsequent times
        if self._initialized:
            return
        super(SanicPlugin, self).__init__(*args, **kwargs)
        self._routes = []
        self._ws = []
        self._static = []
        self._middlewares = []
        self._exceptions = []
        self._listeners = defaultdict(list)
        self.registrations = set()
        self._initialized = True

    def __getstate__(self):
        state_dict = {}
        for s in SanicPlugin.__slots__:
            state_dict[s] = getattr(self, s)
        return state_dict

    def __setstate__(self, state):
        for s, v in state.items():
            if s == "__weakref__":
                if v is None:
                    continue
                else:
                    raise NotImplementedError("Setting weakrefs on Plugin")
            setattr(self, s, v)

    def __reduce__(self):
        state_dict = self.__getstate__()
        return SanicPlugin.__new__, (self.__class__,), state_dict
