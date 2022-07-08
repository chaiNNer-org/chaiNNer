/* eslint-disable max-classes-per-file */
import {
    BinaryFn,
    UnaryFn,
    add,
    concat,
    divide,
    maximum,
    minimum,
    multiply,
    negate,
    round,
    subtract,
    toString,
} from './builtin';
import { Expression, NamedExpression, UnionExpression } from './expression';
import {
    assertValidFunctionName,
    assertValidStructFieldName,
    assertValidStructName,
} from './names';
import {
    AnyType,
    IntIntervalType,
    NeverType,
    NumberPrimitive,
    NumberType,
    NumericLiteralType,
    StringType,
    StructType,
    Type,
} from './types';
import { union } from './union';

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

export class BuiltinFunctionDefinition {
    readonly name: string;

    readonly args: readonly Expression[];

    readonly fn: (...args: Type[]) => Type;

    constructor(name: string, fn: (..._: Type[]) => Type, args: readonly Expression[]) {
        assertValidFunctionName(name);
        this.name = name;
        this.args = args;
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
export interface BuiltinFunctionDefinitionEntry {
    readonly definition: BuiltinFunctionDefinition;
    evaluatedArgs?: Type[];
}
export type TypeDefinitionEntry = AliasDefinitionEntry | StructDefinitionEntry;

const addBuiltinTypes = (definitions: TypeDefinitions) => {
    const constants: string[] = [
        'null',

        'Audio',
        'Video',

        'ImageFile',
        'VideoFile',
        'AudioFile',

        'PthFile',
        'PtFile',
        'PyTorchScript',

        'NcnnBinFile',
        'NcnnParamFile',
        'NcnnNetwork',

        'OnnxFile',
        'OnnxModel',

        'IteratorAuto',

        'AdaptiveMethod',
        'AdaptiveThresholdType',
        'BlendMode',
        'BorderType',
        'Colorspace',
        'FillColor',
        'FillMethod',
        'FlipAxis',
        'ImageExtension',
        'InterpolationMode',
        'Orientation',
        'OverflowMethod',
        'ReciprocalScalingFactor',
        'RotateExpandCrop',
        'RotateInterpolationMode',
        'ThresholdType',
        'TileMode',
        'VideoType',

        'MathOpAdd',
        'MathOpSub',
        'MathOpMul',
        'MathOpDiv',
        'MathOpPow',
        'MathOpMax',
        'MathOpMin',
    ];
    for (const name of constants) {
        definitions.add(new StructDefinition(name));
    }

    definitions.add(new AliasDefinition('int', [], new IntIntervalType(-Infinity, Infinity)));
    definitions.add(new AliasDefinition('uint', [], new IntIntervalType(0, Infinity)));

    definitions.add(
        new AliasDefinition(
            'MathOp',
            [],
            new UnionExpression([
                new NamedExpression('MathOpAdd'),
                new NamedExpression('MathOpSub'),
                new NamedExpression('MathOpMul'),
                new NamedExpression('MathOpDiv'),
                new NamedExpression('MathOpPow'),
                new NamedExpression('MathOpMax'),
                new NamedExpression('MathOpMin'),
            ])
        )
    );

    definitions.add(
        new StructDefinition('Image', [
            new StructFieldDefinition('width', new NamedExpression('uint')),
            new StructFieldDefinition('height', new NamedExpression('uint')),
            new StructFieldDefinition('channels', new IntIntervalType(1, Infinity)),
        ])
    );
    definitions.add(
        new StructDefinition('Directory', [new StructFieldDefinition('path', StringType.instance)])
    );
    definitions.add(
        new StructDefinition('PyTorchModel', [
            new StructFieldDefinition('scale', new IntIntervalType(1, Infinity)),
            new StructFieldDefinition('inputChannels', new IntIntervalType(1, Infinity)),
            new StructFieldDefinition('outputChannels', new IntIntervalType(1, Infinity)),
        ])
    );

    definitions.add(
        new StructDefinition('ColorMode', [
            new StructFieldDefinition(
                'inputChannels',
                new UnionExpression([
                    new NumericLiteralType(1),
                    new NumericLiteralType(3),
                    new NumericLiteralType(4),
                ])
            ),
            new StructFieldDefinition(
                'outputChannels',
                new UnionExpression([
                    new NumericLiteralType(1),
                    new NumericLiteralType(3),
                    new NumericLiteralType(4),
                ])
            ),
        ])
    );
};
const addBuiltinFunctions = (definitions: TypeDefinitions) => {
    const unaryNumber: Record<string, UnaryFn<NumberPrimitive>> = {
        negate,
        round,
    };
    const binaryNumber: Record<string, BinaryFn<NumberPrimitive>> = {
        add,
        subtract,
        multiply,
        divide,
        min: minimum,
        max: maximum,
    };

    for (const [name, fn] of Object.entries(unaryNumber)) {
        definitions.addFunction(BuiltinFunctionDefinition.unary(name, fn, NumberType.instance));
    }
    for (const [name, fn] of Object.entries(binaryNumber)) {
        definitions.addFunction(
            BuiltinFunctionDefinition.binary(name, fn, NumberType.instance, NumberType.instance)
        );
    }

    definitions.addFunction(
        BuiltinFunctionDefinition.unary(
            'string',
            toString,
            union(StringType.instance, NumberType.instance)
        )
    );
    definitions.addFunction(
        BuiltinFunctionDefinition.binary('concat', concat, StringType.instance, StringType.instance)
    );
};

export class TypeDefinitions {
    private readonly defs = new Map<string, TypeDefinitionEntry>();

    private readonly functions = new Map<string, BuiltinFunctionDefinitionEntry>();

    constructor() {
        // alias fail-safes for primitives
        this.add(new AliasDefinition('any', [], AnyType.instance));
        this.add(new AliasDefinition('never', [], NeverType.instance));
        this.add(new AliasDefinition('number', [], NumberType.instance));
        this.add(new AliasDefinition('string', [], StringType.instance));

        addBuiltinTypes(this);
        addBuiltinFunctions(this);
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

    addFunction(definition: BuiltinFunctionDefinition): void {
        if (this.functions.has(definition.name)) {
            throw new Error(`The function name ${definition.name} is already occupied.`);
        }

        this.functions.set(definition.name, { definition });
    }

    get(name: string): TypeDefinitionEntry | undefined {
        return this.defs.get(name);
    }

    getFunction(name: string): BuiltinFunctionDefinitionEntry | undefined {
        return this.functions.get(name);
    }

    names(): Iterable<string> {
        return this.defs.keys();
    }
}
