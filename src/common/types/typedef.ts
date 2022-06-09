/* eslint-disable max-classes-per-file */
import { Expression, NamedExpression } from './expression';
import { assertValidStructFieldName, assertValidStructName } from './names';
import {
    AnyType,
    IntIntervalType,
    NeverType,
    NumberType,
    StringType,
    StructType,
    Type,
} from './types';

export type Definition = StructDefinition | AliasDefinition;

export class StructFieldDefinition {
    public readonly name: string;

    public readonly type: Expression;

    constructor(name: string, type: Expression) {
        assertValidStructFieldName(name);
        this.name = name;
        this.type = type;
    }
}
export class StructDefinition {
    public readonly name: string;

    public readonly fields: readonly StructFieldDefinition[];

    public readonly fieldNames: ReadonlySet<string>;

    constructor(name: string, fields: readonly StructFieldDefinition[] = []) {
        assertValidStructName(name);
        this.name = name;
        this.fields = fields;

        const names = new Set<string>();
        this.fieldNames = names;
        for (const f of fields) {
            if (names.has(f.name)) {
                throw new Error(
                    `Invalid strut definition. ` +
                        `The field ${f.name} was used twice in ${this.toString()}`
                );
            }
            names.add(f.name);
        }
    }

    toString(): string {
        if (this.fields.length === 0) return `struct ${this.name}`;
        return `struct ${this.name} { ${this.fields
            .map((f) => `${f.name}: ${f.type.toString()}`)
            .join(', ')} }`;
    }
}

export class AliasParameterDefinition {
    public readonly name: string;

    public readonly type: Expression;

    constructor(name: string, type: Expression = AnyType.instance) {
        assertValidStructFieldName(name);
        this.name = name;
        this.type = type;
    }
}
export class AliasDefinition {
    public readonly name: string;

    readonly parameters: readonly AliasParameterDefinition[];

    readonly parameterNames: ReadonlySet<string>;

    public readonly type: Expression;

    constructor(name: string, parameters: readonly AliasParameterDefinition[], type: Expression) {
        assertValidStructName(name);
        this.name = name;
        this.parameters = parameters;
        this.type = type;

        const names = new Set<string>();
        this.parameterNames = names;
        for (const f of parameters) {
            if (names.has(f.name)) {
                throw new Error(
                    `Invalid alias definition. ` +
                        `The parameter ${f.name} was used twice in ${this.toString()}`
                );
            }
            names.add(f.name);
        }
    }

    toString(): string {
        if (this.parameters.length > 0) {
            const params = this.parameters
                .map((p) => {
                    if (p.type.type === 'any') return p.name;
                    return `${p.name}: ${p.type.toString()}`;
                })
                .join(', ');
            return `alias ${this.name} { ${params} } = ${this.type.toString()}`;
        }
        return `alias ${this.name} = ${this.type.toString()}`;
    }
}

export interface AliasDefinitionEntry {
    readonly kind: 'alias';
    readonly definition: AliasDefinition;
    evaluatedParams?: Type[];
    evaluated?: Type;
}
export interface StructDefinitionEntry {
    readonly kind: 'struct';
    readonly definition: StructDefinition;
    evaluated?: StructType | NeverType;
}
export type TypeDefinitionEntry = AliasDefinitionEntry | StructDefinitionEntry;

const addBuiltinTypes = (definitions: TypeDefinitions) => {
    definitions.add(new StructDefinition('null'));
    definitions.add(new AliasDefinition('int', [], new IntIntervalType(-Infinity, Infinity)));
    definitions.add(new AliasDefinition('uint', [], new IntIntervalType(0, Infinity)));

    definitions.add(
        new StructDefinition('Image', [
            new StructFieldDefinition('width', new NamedExpression('uint')),
            new StructFieldDefinition('height', new NamedExpression('uint')),
            new StructFieldDefinition('channels', new IntIntervalType(1, Infinity)),
        ])
    );
};

export class TypeDefinitions {
    private readonly defs = new Map<string, TypeDefinitionEntry>();

    constructor() {
        // alias fail-safes for primitives
        this.add(new AliasDefinition('any', [], AnyType.instance));
        this.add(new AliasDefinition('never', [], NeverType.instance));
        this.add(new AliasDefinition('number', [], NumberType.instance));
        this.add(new AliasDefinition('string', [], StringType.instance));

        addBuiltinTypes(this);
    }

    private assertUnusedName(name: string): void {
        const foo = this.defs.get(name);
        if (foo) {
            throw new Error(`The name ${name} is already occupied by: ${foo.toString()}`);
        }
    }

    add(definition: Definition): void {
        this.assertUnusedName(definition.name);

        let entry: TypeDefinitionEntry;
        if (definition instanceof AliasDefinition) {
            entry = { kind: 'alias', definition };
        } else {
            entry = { kind: 'struct', definition };
        }

        this.defs.set(definition.name, entry);
    }

    get(name: string): TypeDefinitionEntry | undefined {
        return this.defs.get(name);
    }

    names(): Iterable<string> {
        return this.defs.keys();
    }
}
