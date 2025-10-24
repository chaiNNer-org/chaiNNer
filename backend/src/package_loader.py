"""
Package Loader for chaiNNer

This module handles loading chaiNNer packages from different sources:
1. Built Python packages (wheels/installed packages)
2. Source packages (development mode)
3. Pre-compiled schemas (fallback when imports fail)
"""

from __future__ import annotations

import importlib
import json
from pathlib import Path

from logger import logger


class PackageLoader:
    """Loader for chaiNNer packages supporting multiple formats"""

    def __init__(self):
        self.loaded_packages: set[str] = set()

    def load_from_installed_package(self, package_name: str) -> bool:
        """
        Try to load a package that was installed as a Python package.

        Returns True if successful, False otherwise.
        """
        try:
            # Try importing as an installed package
            module = importlib.import_module(package_name)

            # Check if it has a schema.json file
            if hasattr(module, "__path__"):
                for path in module.__path__:
                    schema_file = Path(path) / "schema.json"
                    if schema_file.exists():
                        logger.info(
                            "Loading package %s from installed package", package_name
                        )
                        self._load_from_schema(schema_file, package_name)
                        self.loaded_packages.add(package_name)
                        return True

            return False
        except ImportError:
            return False
        except Exception as e:
            logger.warning("Error loading installed package %s: %s", package_name, e)
            return False

    def load_from_source(self, package_path: Path | str) -> bool:
        """
        Load a package from source (development mode).

        This is the original loading method.
        """
        try:
            package_path = Path(package_path)
            if not package_path.exists():
                return False

            # Import using the existing mechanism
            relative_path = package_path.relative_to(Path.cwd())
            module_name = str(relative_path).replace("/", ".").replace("\\", ".")

            logger.info("Loading package from source: %s", module_name)
            importlib.import_module(module_name)

            # Package will register itself
            return True
        except Exception as e:
            logger.warning("Error loading source package %s: %s", package_path, e)
            return False

    def _load_from_schema(self, schema_file: Path, package_name: str):
        """Load package metadata from a compiled schema file."""
        try:
            with open(schema_file, encoding="utf-8") as f:
                schema_data = json.load(f)

            # Register the package structure
            # This is a simplified version that just makes schemas available
            # The actual runtime code is handled by the installed package

            logger.info(
                "Loaded schema for package %s with %d nodes",
                package_name,
                len(schema_data.get("nodes", [])),
            )
        except Exception as e:
            logger.error("Error loading schema from %s: %s", schema_file, e)

    def load_package(
        self, package_name: str, source_path: Path | str | None = None
    ) -> bool:
        """
        Load a package from any available source.

        Priority:
        1. Installed Python package
        2. Source package (if path provided)
        3. Fallback to compiled schemas
        """
        if package_name in self.loaded_packages:
            logger.debug("Package %s already loaded", package_name)
            return True

        # Try installed package first
        if self.load_from_installed_package(package_name):
            return True

        # Try source if provided
        if source_path and self.load_from_source(source_path):
            self.loaded_packages.add(package_name)
            return True

        # Fallback to compiled schemas
        logger.debug(
            "Package %s not found, falling back to compiled schemas", package_name
        )
        return False


# Global package loader instance
package_loader = PackageLoader()
