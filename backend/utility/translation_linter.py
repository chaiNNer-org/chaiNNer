import ast
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


class TranslationLinter(ast.NodeVisitor):
    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.violations: list[tuple[int, str]] = []

    def _get_decorator_arg(self, decorator: ast.Call, arg_name: str):
        """Extract a keyword argument value from a decorator call."""
        for keyword in decorator.keywords:
            if keyword.arg == arg_name:
                if isinstance(keyword.value, ast.Constant):
                    return keyword.value.value
        return None

    def _check_translation_file(self, decorator: ast.Call, xml_path: Path) -> None:
        tree = ET.parse(xml_path)
        root = tree.getroot()

        namespace = root.get(
            "{http://www.w3.org/2001/XMLSchema-instance}noNamespaceSchemaLocation"
        )

        if namespace is None:
            self.violations.append(
                (
                    decorator.lineno,
                    f"Missing 'xsi:noNamespaceSchemaLocation' attribute in {xml_path.name}",
                )
            )
        elif namespace.endswith("node_translations_schema.xsd") is False:
            self.violations.append(
                (
                    decorator.lineno,
                    f"'xsi:noNamespaceSchemaLocation' should point to 'node_translations_schema.xsd' in {xml_path.name}",
                )
            )

        schema_id = self._get_decorator_arg(decorator, "schema_id")
        if root.get("id") != schema_id:
            self.violations.append(
                (
                    decorator.lineno,
                    f"Schema ID mismatch: decorator has '{schema_id}' but XML root 'id' is '{root.get('id')}' in {xml_path.name}",
                )
            )

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Call) and isinstance(
                decorator.func, ast.Attribute
            ):
                if decorator.func.attr == "register":
                    xml_path = self.file_path.with_suffix(".translations.xml")
                    if not xml_path.exists():
                        self.violations.append(
                            (
                                decorator.lineno,
                                f"Missing translation XML file: {xml_path.name}",
                            )
                        )
                    self._check_translation_file(decorator, xml_path)


def lint_file(file_path: Path) -> list[tuple[int, str]]:
    try:
        with open(file_path, encoding="utf-8") as file:
            file_content = file.read()

        ast_tree = ast.parse(file_content, filename=str(file_path))
        linter = TranslationLinter(file_path)
        linter.visit(ast_tree)

        return linter.violations

    except SyntaxError as e:
        print(f"Syntax error in file {file_path}: {e}")
        return []

    except Exception as e:
        print(f"Error processing file {file_path}: {e}")
        return []


def main():
    if len(sys.argv) < 2:
        print("Usage: python translation_linter.py <file_or_directory>")
        print(
            "Checks that backend package modules have matching translation XML files."
        )
        sys.exit(1)

    path = Path(sys.argv[1])

    if not path.exists():
        print(f"Error: The path '{path}' does not exist.")
        sys.exit(1)

    if path.is_file():
        total_violations = lint_file(path)
        if total_violations:
            for line, message in total_violations:
                print(f"{path} {line}: {message}")
        total = len(total_violations)
    else:
        total = 0

        for file_path in path.rglob("*.py"):
            violations = lint_file(file_path)
            if violations:
                for line, message in violations:
                    print(f"{file_path} {line}: {message}")
                total += len(violations)

    if total > 0:
        print(f"\nTotal violations found: {total}")
        sys.exit(1)
    else:
        print("\nNo violations found.")
        sys.exit(0)


if __name__ == "__main__":
    main()
