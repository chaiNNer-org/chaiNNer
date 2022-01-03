from ...exceptions import InitError
from ..base import Extension
from .cors import add_cors
from .methods import add_auto_handlers, add_http_methods


class HTTPExtension(Extension):
    name = "http"

    def __init__(self, *args) -> None:
        super().__init__(*args)
        self.all_methods: bool = self.config.HTTP_ALL_METHODS
        self.auto_head: bool = self.config.HTTP_AUTO_HEAD
        self.auto_options: bool = self.config.HTTP_AUTO_OPTIONS
        self.auto_trace: bool = self.config.HTTP_AUTO_TRACE
        self.cors: bool = self.config.CORS

    def startup(self, _) -> None:
        if self.all_methods:
            add_http_methods(self.app, ["CONNECT", "TRACE"])

        if self.auto_head or self.auto_options or self.auto_trace:
            add_auto_handlers(
                self.app, self.auto_head, self.auto_options, self.auto_trace
            )

        if self.cors:
            add_cors(self.app)
        else:
            return

        if self.app.ctx.cors.automatic_options and not self.auto_options:
            raise InitError(
                "Configuration mismatch. If CORS_AUTOMATIC_OPTIONS is set to "
                "True, then you must run SanicExt with auto_options=True"
            )
