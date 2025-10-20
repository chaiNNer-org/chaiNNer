/**
 * Topological sort for migration ordering.
 *
 * This module implements the algorithm to determine the order in which
 * migrations should be applied, considering dependencies between nodes.
 */

import { SchemaId } from '../common-types';
import { log } from '../log';
import { Migration, NodeDependencyMigration } from './migrations.d';

/**
 * Represents a migration task with its node and migration index.
 */
export interface MigrationTask {
    readonly schemaId: SchemaId;
    readonly migrationIndex: number;
    readonly migration: Migration;
}

/**
 * Build a dependency graph for migrations.
 *
 * Returns a map of migration tasks to their dependencies.
 */
function buildDependencyGraph(
    schemas: Map<SchemaId, { migrations: readonly Migration[] }>
): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    
    const taskKey = (schemaId: SchemaId, index: number): string =>
        `${schemaId}:${index}`;
    
    const schemaEntries = Array.from(schemas.entries());
    for (const [schemaId, schema] of schemaEntries) {
        const { migrations } = schema;
        
        // Each migration depends on the previous migration in the same node
        for (let i = 0; i < migrations.length; i++) {
            const key = taskKey(schemaId, i);
            const deps = new Set<string>();
            
            // Depend on previous migration
            if (i > 0) {
                deps.add(taskKey(schemaId, i - 1));
            }
            
            // Check for node dependencies
            const migration = migrations[i];
            if (migration.kind === 'node_dependency') {
                const dep = migration as NodeDependencyMigration;
                const depSchema = schemas.get(dep.schemaId);
                
                if (depSchema) {
                    // This migration needs the dependency at exactly the specified version
                    // So it must run after that version's migration
                    if (dep.version > 0) {
                        deps.add(taskKey(dep.schemaId, dep.version - 1));
                    }
                    
                    // And it must run before the next migration of the dependency
                    if (dep.version < depSchema.migrations.length) {
                        // The next migration of the dependency depends on this migration
                        const nextDepKey = taskKey(dep.schemaId, dep.version);
                        if (!graph.has(nextDepKey)) {
                            graph.set(nextDepKey, new Set());
                        }
                        graph.get(nextDepKey)!.add(key);
                    }
                }
            }
            
            graph.set(key, deps);
        }
    }
    
    return graph;
}

/**
 * Perform a topological sort on the migration dependency graph.
 *
 * Returns migrations in the order they should be applied.
 * Throws an error if a cycle is detected.
 */
export function topologicalSort(
    schemas: Map<SchemaId, { migrations: readonly Migration[] }>
): MigrationTask[] {
    const graph = buildDependencyGraph(schemas);
    const result: MigrationTask[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const parseKey = (key: string): [SchemaId, number] => {
        const [schemaId, indexStr] = key.split(':');
        return [schemaId as SchemaId, Number(indexStr)];
    };
    
    const visit = (key: string): void => {
        if (visited.has(key)) return;
        
        if (visiting.has(key)) {
            throw new Error(`Circular migration dependency detected at ${key}`);
        }
        
        visiting.add(key);
        
        const deps = graph.get(key) || new Set();
        const depsArray = Array.from(deps);
        for (const dep of depsArray) {
            visit(dep);
        }
        
        visiting.delete(key);
        visited.add(key);
        
        const [schemaId, migrationIndex] = parseKey(key);
        const schema = schemas.get(schemaId);
        if (schema) {
            result.push({
                schemaId,
                migrationIndex,
                migration: schema.migrations[migrationIndex],
            });
        }
    };
    
    // Visit all migration tasks
    const graphKeys = Array.from(graph.keys());
    for (const key of graphKeys) {
        visit(key);
    }
    
    log.info(`Computed migration order for ${result.length} migrations`);
    return result;
}

/**
 * Get migrations that need to be applied to a node.
 *
 * @param schemaId The schema ID of the node
 * @param currentVersion The current version of the node in the save file
 * @param schemas Map of all available schemas
 * @returns List of migration tasks to apply
 */
export function getMigrationsForNode(
    schemaId: SchemaId,
    currentVersion: number,
    schemas: Map<SchemaId, { migrations: readonly Migration[] }>
): MigrationTask[] {
    const schema = schemas.get(schemaId);
    if (!schema) {
        return [];
    }
    
    const tasks: MigrationTask[] = [];
    for (let i = currentVersion; i < schema.migrations.length; i++) {
        tasks.push({
            schemaId,
            migrationIndex: i,
            migration: schema.migrations[i],
        });
    }
    
    return tasks;
}
