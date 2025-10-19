"""
Declarative per-node migrations for chaiNNer.

This module provides the infrastructure for declaring migrations on nodes themselves,
rather than as global migration functions in the frontend. This allows:
1. Migrations to be defined in Python alongside the nodes they affect
2. Trivial reuse of common migration patterns
3. Plugin authors to add migrations without frontend knowledge
4. Decoupling migrations from save data format

Migration types include:
- rename: Node was renamed (old schema_id -> new schema_id)
- change_inputs: Inputs were added, removed, reordered, or had their defaults changed
- change_outputs: Outputs were added, removed, or reordered
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Migration(ABC):
    """
    Base class for all migrations.
    
    Each migration represents a change to a node that requires updating save data.
    Migrations are applied in order, and may depend on specific versions of other nodes.
    """
    
    @abstractmethod
    def to_dict(self) -> dict[str, Any]:
        """Convert the migration to a JSON-serializable dictionary."""
        pass


@dataclass(frozen=True)
class RenameMigration(Migration):
    """
    Migration for when a node's schema_id has changed.
    
    Args:
        old: The old schema_id that should be migrated to the new one
    
    Example:
        @register(
            schema_id="chainner:image:my_new_name",
            migrations=[rename(old="chainner:image:my_old_name")]
        )
    """
    old: str
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": "rename",
            "old": self.old,
        }


@dataclass(frozen=True)
class ChangeInputsMigration(Migration):
    """
    Migration for when a node's inputs have changed.
    
    This can handle:
    - Adding new inputs (they will use their default values)
    - Removing inputs (the input data will be discarded)
    - Renaming inputs (mapping old input IDs to new ones)
    - Changing input defaults
    
    Args:
        remove: List of input IDs to remove
        rename: Mapping of old input IDs to new input IDs
        add: Mapping of new input IDs to their default values
    
    Example:
        @register(
            migrations=[
                change_inputs(
                    rename={1: 2, 2: 1},  # swap inputs 1 and 2
                    remove=[3],  # remove old input 3
                )
            ]
        )
    """
    remove: list[int] | None = None
    rename: dict[int, int] | None = None
    add: dict[int, Any] | None = None
    
    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"kind": "change_inputs"}
        if self.remove:
            result["remove"] = self.remove
        if self.rename:
            result["rename"] = {str(k): v for k, v in self.rename.items()}
        if self.add:
            result["add"] = {str(k): v for k, v in self.add.items()}
        return result


@dataclass(frozen=True)
class ChangeOutputsMigration(Migration):
    """
    Migration for when a node's outputs have changed.
    
    This can handle:
    - Removing outputs (edges will be removed)
    - Renaming outputs (mapping old output IDs to new ones)
    
    Args:
        remove: List of output IDs to remove
        rename: Mapping of old output IDs to new output IDs
    
    Example:
        @register(
            migrations=[
                change_outputs(
                    rename={0: 1, 1: 0},  # swap outputs
                )
            ]
        )
    """
    remove: list[int] | None = None
    rename: dict[int, int] | None = None
    
    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"kind": "change_outputs"}
        if self.remove:
            result["remove"] = self.remove
        if self.rename:
            result["rename"] = {str(k): v for k, v in self.rename.items()}
        return result


@dataclass(frozen=True)
class NodeDependencyMigration(Migration):
    """
    Migration that depends on a specific version of another node.
    
    This is used when a migration needs to create or interact with another node,
    and that node's schema may have changed. By declaring a dependency on a specific
    version, the migration system ensures that:
    1. The dependency node is migrated to the specified version before this migration runs
    2. This migration is applied before the dependency node is migrated beyond the specified version
    
    Args:
        schema_id: The schema_id of the node this migration depends on
        version: The version of that node this migration was written for
    
    Example:
        If migration m2 of node M creates a node N v1, and N has 3 migrations (n1, n2, n3):
        
        @register(
            schema_id="M",
            migrations=[
                m1,
                depends_on("N", version=1),  # m2 will create N v1
                m2,  # creates N v1 nodes
                m3,
            ]
        )
        
        This ensures m2 runs after n1 but before n2, so created nodes will be N v1.
    """
    schema_id: str
    version: int
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": "node_dependency",
            "schemaId": self.schema_id,
            "version": self.version,
        }


# Convenience functions for creating migrations
def rename(old: str) -> RenameMigration:
    """Create a rename migration."""
    return RenameMigration(old=old)


def change_inputs(
    remove: list[int] | None = None,
    rename: dict[int, int] | None = None,
    add: dict[int, Any] | None = None,
) -> ChangeInputsMigration:
    """Create a change_inputs migration."""
    return ChangeInputsMigration(remove=remove, rename=rename, add=add)


def change_outputs(
    remove: list[int] | None = None,
    rename: dict[int, int] | None = None,
) -> ChangeOutputsMigration:
    """Create a change_outputs migration."""
    return ChangeOutputsMigration(remove=remove, rename=rename)


def depends_on(schema_id: str, version: int) -> NodeDependencyMigration:
    """Create a node dependency migration."""
    return NodeDependencyMigration(schema_id=schema_id, version=version)
