# Declarative Per-Node Migrations

This document describes how to use the declarative per-node migration system in chaiNNer.

## Overview

Per-node migrations allow you to declare changes to your nodes directly in Python, without needing to write TypeScript migration code. The frontend automatically applies these migrations when loading save files.

## Migration Types

### Rename Migration

Use when a node's schema_id has changed:

```python
from api import rename

@register(
    schema_id="chainner:image:my_new_name",
    name="My Node",
    migrations=[
        rename(old="chainner:image:my_old_name")
    ],
    # ... rest of node definition
)
def my_node(...):
    pass
```

### Change Inputs Migration

Use when inputs have been added, removed, or reordered:

```python
from api import change_inputs

@register(
    schema_id="chainner:image:my_node",
    name="My Node",
    migrations=[
        # Remove input 3, rename inputs 1->2 and 2->1 (swap)
        change_inputs(
            remove=[3],
            rename={1: 2, 2: 1}
        ),
        # Add a new input with a default value
        change_inputs(
            add={4: 100}  # input 4 defaults to 100
        ),
    ],
    # ... rest of node definition
)
def my_node(...):
    pass
```

### Change Outputs Migration

Use when outputs have been removed or reordered:

```python
from api import change_outputs

@register(
    schema_id="chainner:image:my_node",
    name="My Node",
    migrations=[
        # Remove output 2, swap outputs 0 and 1
        change_outputs(
            remove=[2],
            rename={0: 1, 1: 0}
        ),
    ],
    # ... rest of node definition
)
def my_node(...):
    pass
```

### Node Dependency Migration

Use when a migration creates or depends on another node at a specific version:

```python
from api import depends_on

@register(
    schema_id="chainner:image:node_creator",
    name="Node Creator",
    migrations=[
        # This migration will create nodes of type "chainner:image:target_node"
        # at version 2 (after 2 migrations)
        depends_on("chainner:image:target_node", version=2),
    ],
    # ... rest of node definition
)
def node_creator(...):
    pass
```

## Migration Ordering

Migrations are applied in a specific order:

1. Within a single node, migrations are applied in the order they are declared
2. Between nodes, migrations are ordered using a topological sort based on dependencies
3. Node dependency migrations create ordering constraints

### Example

If node M's migration m2 creates nodes of type N at version 1:

```python
# Node N
@register(
    schema_id="N",
    migrations=[
        n1,  # version 1
        n2,  # version 2
        n3,  # version 3
    ],
)
def node_n(...): pass

# Node M
@register(
    schema_id="M",
    migrations=[
        m1,
        depends_on("N", version=1),  # Ensures N is at exactly version 1
        m2,  # Creates N v1 nodes
        m3,
    ],
)
def node_m(...): pass
```

The system ensures:
- m2 runs after n1 (so N v1 exists)
- m2 runs before n2 (so created nodes are N v1, not N v2)
- Created N v1 nodes are then migrated to N v3 automatically

## Best Practices

1. **Keep migrations simple**: Each migration should do one thing
2. **Add migrations incrementally**: Don't combine multiple changes in one migration
3. **Test thoroughly**: Ensure old save files load correctly with your migrations
4. **Document breaking changes**: Add comments explaining why each migration exists
5. **Use node dependencies carefully**: Only when one node truly depends on another's structure

## Version Numbers

- A node with no migrations is version 0
- Each migration adds 1 to the version number
- Version numbers are implicit - they're just the count of migrations

## Limitations

- Migrations cannot currently modify node positions or connections (except output removal)
- Custom migration logic still requires TypeScript for complex transformations
- The system applies all migrations from the last saved version to current

## Future Enhancements

Planned improvements include:
- More migration types (e.g., conditional migrations)
- Migration validation and testing tools
- Migration preview/dry-run capability
