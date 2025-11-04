# Node Documentation Generation Scripts

This directory contains scripts for generating markdown documentation for all chaiNNer nodes.

## Scripts

### `generate_node_docs.py`

Main script that generates markdown documentation files from node data.

**Usage:**

```bash
# Fetch from a running backend server
python generate_node_docs.py --url http://127.0.0.1:8000

# Generate from a JSON file
python generate_node_docs.py --file nodes_data.json

# Automatically start backend server
python generate_node_docs.py --start-server --server-port 8765

# Specify custom output directory
python generate_node_docs.py --file nodes_data.json --output-dir ./custom_docs
```

**Output:**

The script generates:
- `docs/08--Nodes-Reference.md` - Main index file listing all categories
- `docs/nodes/<category_id>.md` - One file per category with all nodes in that category

### `fetch_nodes.py`

Helper script to fetch node data from a running backend server and save to JSON.

**Usage:**

```bash
# Fetch from default server (http://127.0.0.1:8000)
python fetch_nodes.py

# Fetch from custom server
python fetch_nodes.py http://127.0.0.1:8765 output.json
```

## Automated Documentation Updates

The `.github/workflows/generate-node-docs.yml` workflow automatically:
1. Runs after each release is published
2. Starts the backend server with all packages installed
3. Fetches node data and generates markdown documentation
4. Updates the GitHub Wiki with the generated documentation

## Local Development

To generate documentation locally:

1. Start the backend server:
   ```bash
   cd backend/src
   python run.py 8000 --install-builtin-packages
   ```

2. In another terminal, generate docs:
   ```bash
   python scripts/generate_node_docs.py
   ```

Or use the automated approach:
```bash
python scripts/generate_node_docs.py --start-server
```

## Output Format

Each category file contains:
- Category name and description
- Node groups within the category
- For each node:
  - Name and Schema ID
  - Description
  - Icon
  - Input parameters with types and descriptions
  - Output types
  - See Also references
  - Deprecation warnings (if applicable)
