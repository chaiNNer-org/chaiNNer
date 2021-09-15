import pkgutil
import importlib

__path__ = pkgutil.extend_path(__path__, __name__)
for importer, modname, ispkg in pkgutil.walk_packages(path=__path__,
                                                      prefix=__name__ + '.'):
    importlib.import_module(modname)
