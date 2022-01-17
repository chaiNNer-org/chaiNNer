from ..base import Extension
from .injector import add_injection
from .registry import InjectionRegistry


class InjectionExtension(Extension):
    name = "injection"

    def startup(self, bootstrap) -> None:
        self.registry = InjectionRegistry()
        add_injection(self.app, self.registry)
        bootstrap._injection_registry = self.registry

    def label(self):
        return f"[{self.registry.length}]"
