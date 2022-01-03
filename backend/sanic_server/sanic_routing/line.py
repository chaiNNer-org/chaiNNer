class Line:
    TAB = "    "

    def __init__(
        self,
        src: str,
        indent: int,
        offset: int = 0,
        render: bool = True,
    ) -> None:
        self.src = src
        self.indent = indent
        self.offset = offset
        self.render = render

    def __str__(self):
        return (self.TAB * self.indent) + self.src + "\n"
