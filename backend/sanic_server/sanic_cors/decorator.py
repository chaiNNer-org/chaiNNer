# -*- coding: utf-8 -*-
"""
    decorator
    ~~~~
    This unit exposes a single decorator which should be used to wrap a
    Sanic route with. It accepts all parameters and options as
    the CORS extension.

    :copyright: (c) 2021 by Ashley Sommer (based on flask-cors by Cory Dolphin).
    :license: MIT, see LICENSE for more details.
"""

from ..sanic_plugin_toolkit import SanicPluginRealm
from .core import *
from .extension import cors


def cross_origin(app, *args, **kwargs):
    """
    This function is the decorator which is used to wrap a Sanic route with.
    In the simplest case, simply use the default parameters to allow all
    origins in what is the most permissive configuration. If this method
    modifies state or performs authentication which may be brute-forced, you
    should add some degree of protection, such as Cross Site Forgery
    Request protection.

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

    :param automatic_options:
        Only applies to the `cross_origin` decorator. If True, Sanic-CORS will
        override Sanic's default OPTIONS handling to return CORS headers for
        OPTIONS requests.

        Default : True
    :type automatic_options: bool

    """
    _options = kwargs
    _real_decorator = cors.decorate(
        app, *args, run_middleware=False, with_context=False, **kwargs
    )

    def wrapped_decorator(f):
        realm = SanicPluginRealm(app)  # get the singleton from the app
        try:
            plugin = realm.register_plugin(cors, skip_reg=True)
        except ValueError as e:
            # this is normal, if this plugin has been registered previously
            assert e.args and len(e.args) > 1
            plugin = e.args[1]
        context = cors.get_context_from_realm(realm)
        log = context.log
        log(
            logging.DEBUG,
            "Enabled {:s} for cross_origin using options: {}".format(
                str(f), str(_options)
            ),
        )
        return _real_decorator(f)

    return wrapped_decorator
