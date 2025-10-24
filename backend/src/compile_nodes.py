#!/usr/bin/env python3
"""
Node Schema Compiler

This script compiles node schemas ahead of time to prevent issues where
nodes fail to import and become completely unavailable. Pre-compiled schemas
can be used for documentation and UI display even if the actual node fails
to import at runtime.

Usage:
    python compile_nodes.py [--output-dir <dir>]
"""

from __future__ import annotations

import argparse
import importlib
import json
import sys
from pathlib import Path
from typing import Any

import api
from api import Group
from logger import logger, setup_logger

# Initialize logger for this script
setup_logger("compile_nodes")


def serialize_node_schema(
    node_data: api.NodeData, node_group: api.NodeGroup
) -> dict[str, Any]:
    """
    Serialize a node's schema to a JSON-compatible dictionary.
    This excludes the runtime 'run' function but keeps all metadata.
    """
    return {
        "schemaId": node_data.schema_id,
        "name": node_data.name,
        "category": node_group.category.id,
        "nodeGroup": node_group.id,
        "inputs": [x.to_dict() for x in node_data.inputs],
        "outputs": [x.to_dict() for x in node_data.outputs],
        "groupLayout": [
            g.to_dict() if isinstance(g, Group) else g for g in node_data.group_layout
        ],
        "iteratorInputs": [x.to_dict() for x in node_data.iterable_inputs],
        "iteratorOutputs": [x.to_dict() for x in node_data.iterable_outputs],
        "keyInfo": node_data.key_info.to_dict() if node_data.key_info else None,
        "suggestions": [x.to_dict() for x in node_data.suggestions],
        "description": node_data.description,
        "seeAlso": node_data.see_also,
        "icon": node_data.icon,
        "kind": node_data.kind,
        "hasSideEffects": node_data.side_effects,
        "deprecated": node_data.deprecated,
        "features": node_data.features,
    }


def serialize_category(category: api.Category) -> dict[str, Any]:
    """Serialize a category to a JSON-compatible dictionary."""
    return category.to_dict()


def serialize_package(package: api.Package) -> dict[str, Any]:
    """Serialize a package to a JSON-compatible dictionary (without nodes)."""
    return package.to_dict()


def compile_nodes(output_dir: Path) -> int:
    """
    Compile all node schemas and write them to JSON files.

    Returns:
        0 on success, non-zero on failure
    """
    try:
        # Import all packages (with error handling for missing dependencies)
        logger.info("Importing packages...")
        packages_to_import = [
            "packages.chaiNNer_standard",
            "packages.chaiNNer_pytorch",
            "packages.chaiNNer_ncnn",
            "packages.chaiNNer_onnx",
            "packages.chaiNNer_external",
        ]

        for package_name in packages_to_import:
            try:
                importlib.import_module(package_name)
                logger.info("  Imported %s", package_name)
            except Exception as e:
                logger.warning("  Failed to import %s: %s", package_name, e)

        # Load nodes
        logger.info("Loading nodes...")
        load_errors = api.registry.load_nodes(__file__)

        # Report any errors
        if len(load_errors) > 0:
            logger.warning("Failed to load %d node(s):", len(load_errors))
            for error in load_errors:
                logger.warning("  %s: %s", error.module, error.error)

        # Count successfully loaded nodes
        node_count = len(api.registry.nodes)
        logger.info("Successfully loaded %d node(s)", node_count)

        # Ensure output directory exists
        output_dir.mkdir(parents=True, exist_ok=True)

        # Compile schemas for each package
        for _package_where, package in api.registry.packages.items():
            package_id = package.id
            logger.info("Compiling schemas for package: %s", package_id)

            # Collect nodes for this package
            package_nodes = []
            package_categories = []

            for category in package.categories:
                # Add category info
                package_categories.append(serialize_category(category))

                # Add all nodes in this category
                for node_group in category.node_groups:
                    for node in node_group.nodes:
                        schema = serialize_node_schema(node, node_group)
                        package_nodes.append(schema)

            # Create package schema
            package_schema = {
                "package": serialize_package(package),
                "categories": package_categories,
                "nodes": package_nodes,
            }

            # Write to file
            output_file = output_dir / f"{package_id}.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(package_schema, f, indent=2, ensure_ascii=False)

            logger.info("  Wrote %d node(s) to %s", len(package_nodes), output_file)

        logger.info("Node compilation completed successfully!")
        return 0

    except Exception as e:
        logger.error("Node compilation failed: %s", e, exc_info=True)
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Compile node schemas to JSON files")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent / "node_schemas",
        help="Directory to write compiled schemas to (default: ./node_schemas)",
    )

    args = parser.parse_args()

    return compile_nodes(args.output_dir)


if __name__ == "__main__":
    sys.exit(main())
