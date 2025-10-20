/**
 * Declarative per-node migrations for chaiNNer.
 *
 * These types correspond to the migration classes defined in the backend.
 */

import { InputId, OutputId, SchemaId } from '../common-types';

export type Migration =
    | RenameMigration
    | ChangeInputsMigration
    | ChangeOutputsMigration
    | NodeDependencyMigration;

export interface RenameMigration {
    readonly kind: 'rename';
    readonly old: SchemaId;
}

export interface ChangeInputsMigration {
    readonly kind: 'change_inputs';
    readonly remove?: readonly InputId[];
    readonly rename?: Readonly<Record<string, InputId>>;
    readonly add?: Readonly<Record<string, unknown>>;
}

export interface ChangeOutputsMigration {
    readonly kind: 'change_outputs';
    readonly remove?: readonly OutputId[];
    readonly rename?: Readonly<Record<string, OutputId>>;
}

export interface NodeDependencyMigration {
    readonly kind: 'node_dependency';
    readonly schemaId: SchemaId;
    readonly version: number;
}

/**
 * Per-node migration metadata.
 *
 * The version of a node is the number of migrations it has.
 * A node with no migrations is v0, one with one migration is v1, etc.
 */
export interface NodeMigrationMetadata {
    readonly schemaId: SchemaId;
    readonly migrations: readonly Migration[];
    readonly version: number;
}
