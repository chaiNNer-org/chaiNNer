/* eslint-disable max-classes-per-file */
import { Definition, FunctionDefinition, StructDefinition, VariableDefinition } from './expression';
import { NeverType, StructType, Type } from './types';

type ScopeDefinition = ScopeStructDefinition | ScopeFunctionDefinition | ScopeVariableDefinition;

export interface ScopeStructDefinition {
    readonly definition: StructDefinition;
    default?: StructType | NeverType;
}
export interface ScopeFunctionDefinition {
    readonly definition: FunctionDefinition;
    parameters?: readonly Type[];
}
export interface ScopeVariableDefinition {
    readonly definition: VariableDefinition;
    value?: Type;
}

/**
 * Implements an F1 score based on bi-grams.
 */
const getSimilarityScore = (a: string, b: string): number => {
    const getBiGrams = (s: string): Set<string> => {
        const bi = new Set<string>();
        for (let i = 1; i < s.length; i += 1) {
            bi.add(s.substring(i - 1, i + 1));
        }
        return bi;
    };

    const aBi = getBiGrams(a);
    const bBi = getBiGrams(b);
    if (aBi.size === 0 || bBi.size === 0) return 0;

    const intersection = [...aBi].filter((g) => bBi.has(g));

    return (2 * intersection.length) / (aBi.size + bBi.size);
};
const getMostSimilar = (target: string, topK: number, others: Iterable<string>): string[] => {
    return [...others]
        .map((name) => {
            return { name, score: getSimilarityScore(name, target) };
        })
        .sort((a, b) => a.score - b.score)
        .map((n) => n.name)
        .slice(-topK);
};

export class NameResolutionError extends Error {
    similar: string[];

    constructor(message: string, similar: string[]) {
        super(message);
        this.similar = similar;
    }
}

export interface ReadonlyScope {
    readonly name: string;
    readonly parent: ReadonlyScope | undefined;
    readonly definitions: ReadonlyMap<string, ScopeDefinition>;
    has(name: string): boolean;
    get(name: string): ScopeDefinition;
}

export class Scope implements ReadonlyScope {
    readonly name: string;

    readonly parent: ReadonlyScope | undefined;

    readonly definitions = new Map<string, ScopeDefinition>();

    constructor(name: string, parent?: ReadonlyScope) {
        this.name = name;
        this.parent = parent;
    }

    private assertNameAvailable(name: string): void {
        const current = this.definitions.get(name);
        if (current) {
            throw new Error(
                `The name "${name}" is already defined by a ${current.definition.type} in ${this.name}.`
            );
        }
    }

    addDefinition(definition: Definition): void {
        const { name } = definition;
        this.assertNameAvailable(name);
        this.definitions.set(name, { definition } as ScopeDefinition);
    }

    private getOptional(name: string): ScopeDefinition | undefined {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        for (let s: ReadonlyScope | undefined = this; s; s = s.parent) {
            const definition = s.definitions.get(name);
            if (definition) {
                return definition;
            }
        }
        return undefined;
    }

    has(name: string): boolean {
        return this.getOptional(name) !== undefined;
    }

    get(name: string): ScopeDefinition {
        const definition = this.getOptional(name);
        if (definition) return definition;

        // Find similar names for the name resolution error
        const allNames = new Set<string>();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        for (let s: ReadonlyScope | undefined = this; s; s = s.parent) {
            for (const n of s.definitions.keys()) {
                allNames.add(n);
            }
        }
        const similar = getMostSimilar(name, 3, allNames);

        throw new NameResolutionError(
            `Unable to resolve name '${name}'. Did you mean: ${similar.join(', ')}?`,
            similar
        );
    }
}
