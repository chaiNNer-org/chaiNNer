import { Definition, StructDefinition } from './expression';
import { NeverType, StructType } from './types';

export interface ScopeStructDefinition {
    readonly definition: StructDefinition;
    default?: StructType | NeverType;
}

export class Scope {
    readonly name: string;

    readonly parent: Scope | undefined;

    readonly structs = new Map<string, ScopeStructDefinition>();

    readonly functions = new Map<string, ScopeStructDefinition>();

    constructor(name: string, parent?: Scope) {
        this.name = name;
        this.parent = parent;
    }

    addDefinition(definition: Definition): void {}
}
