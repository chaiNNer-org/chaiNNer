# -*- coding: utf-8 -*-
"""
Allows SPTK to parse a config file and automatically load defined plugins
"""

import configparser
import importlib
import os

import pkg_resources


def _find_config_file(filename):
    abs = os.path.abspath(filename)
    if os.path.isfile(abs):
        return abs
    raise FileNotFoundError(filename)


def _get_config_defaults():
    return {}


def _find_advertised_plugins(realm):
    plugins = {}
    for entrypoint in pkg_resources.iter_entry_points('sanic_plugins'):
        if entrypoint.attrs:
            attr = entrypoint.attrs[0]
        else:
            attr = None
        name = entrypoint.name
        try:
            module = importlib.import_module(entrypoint.module_name)
        except ImportError:
            realm.error("Cannot import {}".format(entrypoint.module_name))
            continue
        p_dict = {'name': name, 'module': module}
        if attr:
            try:
                inst = getattr(module, attr)
            except AttributeError:
                realm.error("Cannot import {} from {}".format(attr, entrypoint.module_name))
                continue
            p_dict['instance'] = inst
        plugins[name] = p_dict
        plugins[str(name).casefold()] = p_dict
    return plugins


def _transform_option_dict(options):
    parts = str(options).split(',')
    args = []
    kwargs = {}
    for part in parts:
        if "=" in part:
            kwparts = part.split('=', 1)
            kwkey = kwparts[0]
            val = kwparts[1]
        else:
            val = part
            kwkey = None

        if val == "True":
            val = True
        elif val == "False":
            val = False
        elif val == "None":
            val = None
        elif '.' in val:
            try:
                f = float(val)
                val = f
            except ValueError:
                pass
        else:
            try:
                i = int(val)
                val = i
            except ValueError:
                pass
        if kwkey:
            kwargs[kwkey] = val
        else:
            args.append(val)
    args = tuple(args)
    return args, kwargs


def _register_advertised_plugin(realm, app, plugin_def, *args, **kwargs):
    name = plugin_def['name']
    realm.info("Found advertised plugin {}.".format(name))
    inst = plugin_def.get('instance', None)
    if inst:
        p = inst
    else:
        p = plugin_def['module']
    return realm.register_plugin(p, *args, **kwargs)


def _try_register_other_plugin(realm, app, plugin_name, *args, **kwargs):
    try:
        module = importlib.import_module(plugin_name)
    except ImportError:
        raise RuntimeError("Do not know how to register plugin: {}".format(plugin_name))
    return realm.register_plugin(module, *args, **kwargs)


def _register_plugins(realm, app, config_plugins):
    advertised_plugins = _find_advertised_plugins(realm)
    registered_plugins = {}
    for plugin, options in config_plugins:
        realm.info("Loading plugin: {}...".format(plugin))
        if options:
            args, kwargs = _transform_option_dict(options)
        else:
            args = tuple()
            kwargs = {}
        p_fold = str(plugin).casefold()
        if p_fold in advertised_plugins:
            assoc = _register_advertised_plugin(realm, app, advertised_plugins[p_fold], *args, **kwargs)
        else:
            assoc = _try_register_other_plugin(realm, app, plugin, *args, **kwargs)
        _p, reg = assoc
        registered_plugins[reg.plugin_name] = assoc
    return registered_plugins


def load_config_file(realm, app, filename):
    """

    :param realm:
    :type realm: sanic_plugin_toolkit.SanicPluginRealm
    :param app:
    :type app: sanic.Sanic
    :param filename:
    :type filename: str
    :return:
    """
    location = _find_config_file(filename)
    realm.info("Loading sanic_plugin_toolkit config file {}.".format(location))

    defaults = _get_config_defaults()
    parser = configparser.ConfigParser(defaults=defaults, allow_no_value=True, strict=False)
    parser.read(location)
    try:
        config_plugins = parser.items('plugins')
    except Exception as e:
        raise e
    # noinspection PyUnusedLocal
    _ = _register_plugins(realm, app, config_plugins)  # noqa: F841
    return
