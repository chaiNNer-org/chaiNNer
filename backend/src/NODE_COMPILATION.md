# Node Schema Compilation

## Overview

Node schema compilation is a feature that pre-generates node metadata (schemas) ahead of time. This solves a critical problem where nodes with missing dependencies would fail to import and become completely invisible in the UI, making it impossible to view their documentation or even know they exist.

## The Problem

Previously, when a node failed to import due to missing dependencies (e.g., missing Python packages), the node would be completely unavailable:
- It wouldn't appear in the sidebar/node selector
- Its documentation couldn't be viewed
- Users wouldn't know the node existed until dependencies were installed

This created a chicken-and-egg problem: users couldn't discover what nodes were available without first installing all dependencies.

## The Solution

Node compilation pre-generates schema files that contain all node metadata (name, description, inputs, outputs, etc.) but excludes the runtime execution code. These schemas are:

1. **Generated at build time** when all dependencies are available
2. **Committed to the repository** (in `backend/src/node_schemas/`)
3. **Used as a fallback** when nodes fail to import at runtime

This allows the UI to display node information even when the actual node implementation can't be loaded.

## How It Works

### 1. Compilation Phase (Development/Build)

During development or build, run:
```bash
npm run compile-nodes
```

This executes `backend/src/compile_nodes.py` which:
- Imports all packages
- Attempts to load all nodes
- For each successfully loaded node, extracts its schema
- Writes schemas to JSON files in `backend/src/node_schemas/`
- Continues gracefully even if some nodes fail to import

### 2. Runtime Phase

When the backend starts (`backend/src/server.py`):
1. Loads pre-compiled schemas from `backend/src/node_schemas/`
2. Attempts to import and load all nodes normally
3. For nodes that succeed, the runtime version is used
4. For nodes that fail, the pre-compiled schema provides fallback metadata

The `/nodes` API endpoint merges both:
- Successfully loaded nodes (with full functionality)
- Compiled schemas for failed nodes (documentation only)

## File Structure

```
backend/src/
├── compile_nodes.py           # Compilation script
├── node_schemas/              # Generated schemas (gitignored)
│   ├── chaiNNer_standard.json
│   ├── chaiNNer_pytorch.json
│   ├── chaiNNer_ncnn.json
│   ├── chaiNNer_onnx.json
│   └── chaiNNer_external.json
└── api/
    └── api.py                 # PackageRegistry with schema loading
```

## Schema Format

Each JSON file contains:
```json
{
  "package": {
    "id": "package_id",
    "name": "Package Name",
    "description": "...",
    "dependencies": [...]
  },
  "categories": [...],
  "nodes": [
    {
      "schemaId": "package:category:node",
      "name": "Node Name",
      "description": "...",
      "inputs": [...],
      "outputs": [...],
      "icon": "...",
      ...
    }
  ]
}
```

## Development Workflow

### Adding/Modifying Nodes

1. Create or modify node implementation
2. Run `npm run compile-nodes` to regenerate schemas
3. Commit both the node implementation and updated schemas

### When to Recompile

Recompile when:
- Adding new nodes
- Modifying node metadata (name, description, inputs, outputs)
- Changing node categories or groups
- Before releases

Don't need to recompile when:
- Only changing node implementation (the `run` function)
- Updating dependencies
- Making non-node changes

## CI/CD Integration

In continuous integration:
1. Install all dependencies
2. Run `npm run compile-nodes`
3. Verify schemas are up-to-date (optionally fail if there are changes)

Example CI check:
```bash
npm run compile-nodes
git diff --exit-code backend/src/node_schemas/
```

## Testing

Tests are in `backend/tests/test_node_compilation.py`:
- Verifies compilation creates output files
- Checks JSON schema structure
- Ensures compilation handles missing dependencies gracefully
- Validates all required fields are present

Run tests:
```bash
pytest backend/tests/test_node_compilation.py
```

## Limitations

- Compiled schemas are read-only documentation
- Nodes with missing dependencies cannot be executed, only viewed
- Schemas must be manually regenerated when nodes change
- Type checking and validation still require runtime loading

## Benefits

1. **Better User Experience**: Users can browse all nodes before installing dependencies
2. **Improved Documentation**: Node docs are always accessible
3. **Dependency Discovery**: Users see what's available and what requires installation
4. **Graceful Degradation**: System continues working even with import failures
5. **Development Safety**: Prevents nodes from becoming "invisible" during development
