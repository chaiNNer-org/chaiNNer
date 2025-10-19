/**
 * Per-node migration application.
 *
 * This module applies per-node migrations declared in the backend after
 * the global legacy migrations have been applied.
 */

import { Edge, Node } from 'reactflow';
import { EdgeData, Mutable, NodeData, NodeSchema, SchemaId } from '../common-types';
import { log } from '../log';
import { SaveData } from '../migrations';
import { applyMigration, getNodeVersion, setNodeVersion } from './apply-migration';
import { Migration } from './migrations.d';
import { getMigrationsForNode, topologicalSort } from './topo-sort';

type N = Node<Mutable<NodeData>>;
type E = Edge<Mutable<EdgeData>>;

/**
 * Build a map of schema migrations from node schemas.
 */
function buildSchemaMigrationMap(
    schemas: readonly NodeSchema[]
): Map<SchemaId, { migrations: readonly Migration[] }> {
    const map = new Map<SchemaId, { migrations: readonly Migration[] }>();
    
    for (const schema of schemas) {
        // Build a map from old schema IDs to current schema IDs for rename migrations
        const migrations = schema.migrations as readonly Migration[];
        
        // Add current schema
        map.set(schema.schemaId, { migrations });
        
        // Add entries for renamed schemas
        for (const migration of migrations) {
            if (migration.kind === 'rename') {
                // Old schema ID should map to current schema with all migrations
                map.set(migration.old, { migrations });
            }
        }
    }
    
    return map;
}

/**
 * Apply per-node migrations to save data.
 *
 * This is called after legacy migrations have been applied.
 */
export function applyPerNodeMigrations(
    data: SaveData,
    schemas: readonly NodeSchema[]
): SaveData {
    if (!schemas || schemas.length === 0) {
        log.warn('No schemas provided for per-node migrations');
        return data;
    }
    
    const schemaMap = buildSchemaMigrationMap(schemas);
    
    // Compute the global migration order
    const orderedMigrations = topologicalSort(schemaMap);
    
    if (orderedMigrations.length === 0) {
        log.info('No per-node migrations to apply');
        return data;
    }
    
    log.info(`Applying ${orderedMigrations.length} per-node migrations`);
    
    // Group migrations by node
    const migrationsByNode = new Map<SchemaId, typeof orderedMigrations>();
    for (const task of orderedMigrations) {
        if (!migrationsByNode.has(task.schemaId)) {
            migrationsByNode.set(task.schemaId, []);
        }
        migrationsByNode.get(task.schemaId)!.push(task);
    }
    
    // Apply migrations to each node
    const context = { nodes: data.nodes, edges: data.edges };
    
    for (const node of data.nodes) {
        let currentSchemaId = node.data.schemaId;
        const currentVersion = getNodeVersion(node);
        
        // Check if this node has migrations to apply
        const nodeMigrations = getMigrationsForNode(
            currentSchemaId,
            currentVersion,
            schemaMap
        );
        
        if (nodeMigrations.length === 0) {
            continue;
        }
        
        log.debug(
            `Applying ${nodeMigrations.length} migrations to node ${node.id} (${currentSchemaId})`
        );
        
        // Apply each migration in order
        for (const task of nodeMigrations) {
            applyMigration(node, task.migration, context);
            
            // If this was a rename migration, update the schema ID
            if (task.migration.kind === 'rename') {
                // Find the current schema (after rename)
                const schema = schemas.find(
                    (s) =>
                        s.schemaId === task.schemaId ||
                        s.migrations.some(
                            (m) => m.kind === 'rename' && m.old === currentSchemaId
                        )
                );
                if (schema) {
                    currentSchemaId = schema.schemaId;
                    node.data.schemaId = currentSchemaId;
                }
            }
        }
        
        // Update node version
        const schema = schemaMap.get(currentSchemaId);
        if (schema) {
            setNodeVersion(node, schema.migrations.length);
        }
    }
    
    return data;
}
