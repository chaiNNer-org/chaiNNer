import re


def clean_route_name(name: str) -> str:
    parts = name.split(".", 1)
    name = parts[-1]
    for target in ("_", ".", "  "):
        name = name.replace(target, " ")

    return name.title()


def get_uri_filter(app):
    """
    Return a filter function that takes a URI and returns whether it should
    be filter out from the swagger documentation or not.

    Arguments:
        app: The application to take `config.API_URI_FILTER` from. Possible
             values for this config option are: `slash` (to keep URIs that
             end with a `/`), `all` (to keep all URIs). All other values
             default to keep all URIs that don't end with a `/`.

    Returns:
        `True` if the URI should be *filtered out* from the swagger
        documentation, and `False` if it should be kept in the documentation.
    """
    choice = getattr(app.config, "API_URI_FILTER", None)

    if choice == "slash":
        # Keep URIs that end with a /.
        return lambda uri: not uri.endswith("/")

    if choice == "all":
        # Keep all URIs.
        return lambda uri: False

    # Keep URIs that don't end with a /, (special case: "/").
    return lambda uri: len(uri) > 1 and uri.endswith("/")


def remove_nulls(dictionary, deep=True):
    """
    Removes all null values from a dictionary.
    """
    return {
        k: remove_nulls(v, deep) if deep and type(v) is dict else v
        for k, v in dictionary.items()
        if v is not None
    }


def remove_nulls_from_kwargs(**kwargs):
    return remove_nulls(kwargs, deep=False)


def get_blueprinted_routes(app):
    for blueprint in app.blueprints.values():
        if not hasattr(blueprint, "routes"):
            continue

        for route in blueprint.routes:
            if hasattr(route.handler, "view_class"):
                # before sanic 21.3, route.handler could be a number of
                # different things, so have to type check
                for http_method in route.methods:
                    _handler = getattr(
                        route.handler.view_class, http_method.lower(), None
                    )
                    if _handler:
                        yield (blueprint.name, _handler)
            else:
                yield (blueprint.name, route.handler)


def get_all_routes(app, skip_prefix):
    uri_filter = get_uri_filter(app)

    for group in app.router.groups.values():
        uri = f"/{group.path}"

        # prior to sanic 21.3 routes came in both forms
        # (e.g. /test and /test/ )
        # after sanic 21.3 routes come in one form,
        # with an attribute "strict",
        # so we simulate that ourselves:

        uris = [uri]
        if not group.strict and len(uri) > 1:
            alt = uri[:-1] if uri.endswith("/") else f"{uri}/"
            uris.append(alt)

        for uri in uris:
            if uri_filter(uri):
                continue

            if skip_prefix and group.raw_path.startswith(
                skip_prefix.lstrip("/")
            ):
                continue

            for parameter in group.params.values():
                uri = re.sub(
                    f"<{parameter.name}.*?>",
                    f"{{{parameter.name}}}",
                    uri,
                )

            for route in group:
                if route.name and "static" in route.name:
                    continue

                method_handlers = [
                    (method, route.handler) for method in route.methods
                ]

                _, name = route.name.split(".", 1)
                yield (uri, name, route.params.values(), method_handlers)
