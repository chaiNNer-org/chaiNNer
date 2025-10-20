/**
 * Executor for declarative per-node migrations.
 *
 * This module applies migrations declared on nodes in the backend.
 */

import { Edge, Node } from 'reactflow';
import {
    EdgeData,
    InputId,
    Mutable,
    NodeData,
    OutputId,
    SchemaId,
} from '../common-types';
import { log } from '../log';
import {
    parseSourceHandle,
    parseTargetHandle,
    stringifySourceHandle,
    stringifyTargetHandle,
} from '../util';
import {
    ChangeInputsMigration,
    ChangeOutputsMigration,
    Migration,
    NodeDependencyMigration,
    RenameMigration,
} from './migrations.d';

type N = Node<Mutable<NodeData>>;
type E = Edge<Mutable<EdgeData>>;

interface MigrationContext {
    nodes: N[];
    edges: E[];
}

/**
 * Apply a rename migration to a node.
 */
function applyRenameMigration(node: N, migration: RenameMigration): void {
    // The rename migration is primarily handled during node lookup.
    // This function exists for completeness but doesn't need to do anything.
    log.debug(`Applying rename migration: ${migration.old} -> ${node.data.schemaId}`);
}

/**
 * Apply a change_inputs migration to a node.
 */
function applyChangeInputsMigration(
    node: N,
    migration: ChangeInputsMigration,
    context: MigrationContext
): void {
    // Create mutable copy of inputData
    const inputData = { ...node.data.inputData };

    // Remove inputs
    if (migration.remove) {
        for (const inputId of migration.remove) {
            delete inputData[inputId];
        }
    }

    // Rename inputs
    if (migration.rename) {
        const newInputData: typeof inputData = {};
        for (const [key, value] of Object.entries(inputData)) {
            const oldId = Number(key) as InputId;
            const newId = migration.rename[key] ?? oldId;
            newInputData[newId] = value;
        }
        Object.assign(inputData, newInputData);
        
        // Clear old keys and set new ones
        for (const key of Object.keys(inputData)) {
            if (!(key in newInputData)) {
                delete inputData[Number(key) as InputId];
            }
        }
        for (const [key, value] of Object.entries(newInputData)) {
            inputData[Number(key) as InputId] = value;
        }

        // Update edges
        for (const edge of context.edges) {
            if (edge.target === node.id && edge.targetHandle) {
                const parsed = parseTargetHandle(edge.targetHandle);
                const newId = migration.rename[String(parsed.inputId)];
                if (newId !== undefined) {
                    edge.targetHandle = stringifyTargetHandle({
                        nodeId: parsed.nodeId,
                        inputId: newId,
                    });
                }
            }
        }
    }

    // Add new inputs with default values
    if (migration.add) {
        for (const [key, value] of Object.entries(migration.add)) {
            const inputId = Number(key) as InputId;
            if (!(inputId in inputData)) {
                inputData[inputId] = value as number | string;
            }
        }
    }
    
    // Update node data
    node.data.inputData = inputData;
}

/**
 * Apply a change_outputs migration to a node.
 */
function applyChangeOutputsMigration(
    node: N,
    migration: ChangeOutputsMigration,
    context: MigrationContext
): void {
    // Remove outputs by removing connected edges
    if (migration.remove) {
        const removeSet = new Set(migration.remove);
        context.edges = context.edges.filter((edge) => {
            if (edge.source === node.id && edge.sourceHandle) {
                const parsed = parseSourceHandle(edge.sourceHandle);
                return !removeSet.has(parsed.outputId);
            }
            return true;
        });
    }

    // Rename outputs by updating edge handles
    if (migration.rename) {
        for (const edge of context.edges) {
            if (edge.source === node.id && edge.sourceHandle) {
                const parsed = parseSourceHandle(edge.sourceHandle);
                const newId = migration.rename[String(parsed.outputId)];
                if (newId !== undefined) {
                    edge.sourceHandle = stringifySourceHandle({
                        nodeId: parsed.nodeId,
                        outputId: newId,
                    });
                }
            }
        }
    }
}

/**
 * Apply a node_dependency migration.
 *
 * This is a marker migration that doesn't modify the node itself,
 * but affects the ordering of migrations during application.
 */
function applyNodeDependencyMigration(
    _node: N,
    migration: NodeDependencyMigration
): void {
    log.debug(
        `Node dependency marker: ${migration.schemaId} v${migration.version}`
    );
}

/**
 * Apply a single migration to a node.
 */
export function applyMigration(
    node: N,
    migration: Migration,
    context: MigrationContext
): void {
    switch (migration.kind) {
        case 'rename':
            applyRenameMigration(node, migration);
            break;
        case 'change_inputs':
            applyChangeInputsMigration(node, migration, context);
            break;
        case 'change_outputs':
            applyChangeOutputsMigration(node, migration, context);
            break;
        case 'node_dependency':
            applyNodeDependencyMigration(node, migration);
            break;
        default:
            log.warn('Unknown migration kind:', migration);
    }
}

/**
 * Get the version of a node from save data.
 * Returns 0 if no version is stored (node has never been migrated).
 */
export function getNodeVersion(node: N): number {
    // Version could be stored in node data in the future
    // For now, all nodes start at version 0
    return 0;
}

/**
 * Set the version of a node in save data.
 */
export function setNodeVersion(node: N, version: number): void {
    // Version storage could be implemented here in the future
    // For now, we don't store versions explicitly
}

/**
 * Get the current version of a node schema (number of migrations).
 */
export function getSchemaVersion(schemaId: SchemaId, schemas: Map<SchemaId, { migrations: readonly Migration[] }>): number {
    const schema = schemas.get(schemaId);
    return schema?.migrations.length ?? 0;
}
