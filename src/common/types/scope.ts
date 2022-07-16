/* eslint-disable max-classes-per-file */
import {
    Definition,
    Expression,
    FunctionDefinition,
    StructDefinition,
    VariableDefinition,
} from './expression';
import { assertValidFunctionName } from './names';
import { NeverType, StructType, Type } from './types';

type ScopeDefinition =
    | ScopeStructDefinition
    | ScopeFunctionDefinition
    | ScopeVariableDefinition
    | ScopeBuiltinFunctionDefinition;

export interface ScopeStructDefinition {
    readonly type: 'struct';
    readonly definition: StructDefinition;
    default?: StructType | NeverType;
}
export interface ScopeFunctionDefinition {
    readonly type: 'function';
    readonly definition: FunctionDefinition;
    parameters?: readonly Type[];
    varArgs?: undefined;
}
export interface ScopeVariableDefinition {
    readonly type: 'variable';
    readonly definition: VariableDefinition;
    value?: Type;
}
export interface ScopeBuiltinFunctionDefinition {
    readonly type: 'builtin-function';
    readonly definition: BuiltinFunctionDefinition;
    parameters?: readonly Type[];
    varArgs?: Type;
}

export class BuiltinFunctionDefinition {
    readonly type = 'builtin-function';

    readonly name: string;

    readonly parameters: readonly Expression[];

    readonly varArgs: Expression | undefined;

    readonly fn: (...args: Type[]) => Type;

    constructor(
        name: string,
        fn: (..._: Type[]) => Type,
        parameters: readonly Expression[],
        varArgs?: Expression
    ) {
        assertValidFunctionName(name);
        this.name = name;
        this.parameters = parameters;
        this.varArgs = varArgs;
        this.fn = fn;
    }

    static unary<T extends Type>(
        name: string,
        fn: (a: T) => Type,
        arg: Expression
    ): BuiltinFunctionDefinition {
        return new BuiltinFunctionDefinition(name, fn as (..._: Type[]) => Type, [arg]);
    }

    static binary<T1 extends Type, T2 extends Type>(
        name: string,
        fn: (a: T1, b: T2) => Type,
        arg0: Expression,
        arg1: Expression
    ): BuiltinFunctionDefinition {
        return new BuiltinFunctionDefinition(name, fn as (..._: Type[]) => Type, [arg0, arg1]);
    }

    static varArgs<T extends Type>(
        name: string,
        fn: (...args: T[]) => Type,
        arg: Expression
    ): BuiltinFunctionDefinition {
        return new BuiltinFunctionDefinition(name, fn as (..._: Type[]) => Type, [], arg);
    }
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

export interface ResolvedName<D extends ScopeDefinition = ScopeDefinition> {
    definition: D;
    scope: ReadonlyScope;
}
export interface ReadonlyScope {
    readonly name: string;
    readonly parent: ReadonlyScope | undefined;
    readonly definitions: ReadonlyMap<string, ScopeDefinition>;
    has(name: string): boolean;
    get(name: string): ResolvedName;
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
                `The name "${name}" is already defined by a ${current.type} in ${this.name}.`
            );
        }
    }

    addDefinition(definition: Definition | BuiltinFunctionDefinition): void {
        const { name, type } = definition;
        this.assertNameAvailable(name);

        const scopeType: ScopeDefinition['type'] = type;
        this.definitions.set(name, { type: scopeType, definition } as ScopeDefinition);
    }

    private getOptional(name: string): ResolvedName | undefined {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        for (let scope: ReadonlyScope | undefined = this; scope; scope = scope.parent) {
            const definition = scope.definitions.get(name);
            if (definition) {
                return { definition, scope };
            }
        }
        return undefined;
    }

    has(name: string): boolean {
        return this.getOptional(name) !== undefined;
    }

    get(name: string): ResolvedName {
        const resolution = this.getOptional(name);
        if (resolution) return resolution;

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
