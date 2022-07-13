/* eslint-disable max-classes-per-file */
import {
    assertValidFunctionName,
    assertValidStructFieldName,
    assertValidStructName,
} from './names';
import { Type } from './types';

type PureExpression =
    | UnionExpression
    | IntersectionExpression
    | NamedExpression
    | FieldAccessExpression
    | FunctionCallExpression
    | MatchExpression
    | ScopeExpression;

export type Expression = Type | PureExpression;

const bracket = (expression: Expression): string => {
    if (expression.type === 'union' || expression.type === 'intersection')
        return `(${expression.toString()})`;
    return expression.toString();
};

interface ExpressionBase {
    readonly type: PureExpression['type'];
    readonly underlying: 'expression';
    toString(): string;
}

export class UnionExpression implements ExpressionBase {
    readonly type = 'union';

    readonly underlying = 'expression';

    readonly items: readonly Expression[];

    constructor(items: readonly Expression[]) {
        this.items = items;
    }

    toString(): string {
        return this.items.map(bracket).join(' | ');
    }
}

export class IntersectionExpression implements ExpressionBase {
    readonly type = 'intersection';

    readonly underlying = 'expression';

    readonly items: readonly Expression[];

    constructor(items: readonly Expression[]) {
        this.items = items;
    }

    toString(): string {
        return this.items.map(bracket).join(' & ');
    }
}

export class NamedExpressionField {
    readonly name: string;

    readonly type: Expression;

    constructor(name: string, type: Expression) {
        assertValidStructFieldName(name);
        this.name = name;
        this.type = type;
    }
}
export class NamedExpression implements ExpressionBase {
    readonly type = 'named';

    readonly underlying = 'expression';

    readonly fields: readonly NamedExpressionField[];

    readonly name: string;

    constructor(name: string, fields: readonly NamedExpressionField[] = []) {
        assertValidStructName(name);
        this.name = name;
        this.fields = fields;
    }

    toString(): string {
        if (this.fields.length === 0) return this.name;
        return `${this.name} { ${this.fields
            .map((f) => `${f.name}: ${f.type.toString()}`)
            .join(', ')} }`;
    }
}

export class FieldAccessExpression implements ExpressionBase {
    readonly type = 'field-access';

    readonly underlying = 'expression';

    readonly of: Expression;

    readonly field: string;

    constructor(of: Expression, field: string) {
        assertValidStructFieldName(field);
        this.of = of;
        this.field = field;
    }

    toString(): string {
        return `${bracket(this.of)}.${this.field}`;
    }
}

export class FunctionCallExpression implements ExpressionBase {
    readonly type = 'builtin-function';

    readonly underlying = 'expression';

    readonly functionName: string;

    readonly args: readonly Expression[];

    constructor(functionName: string, args: readonly Expression[]) {
        assertValidFunctionName(functionName);
        this.functionName = functionName;
        this.args = args;
    }

    toString(): string {
        return `${this.functionName}(${this.args.map((e) => e.toString()).join(', ')})`;
    }
}

export class MatchArm {
    readonly pattern: Expression;

    readonly binding: string | undefined;

    readonly to: Expression;

    constructor(pattern: Expression, binding: string | undefined, to: Expression) {
        if (binding !== undefined) assertValidStructFieldName(binding);
        this.pattern = pattern;
        this.binding = binding;
        this.to = to;
    }

    toString(): string {
        const pattern = this.pattern.type === 'any' ? '_' : this.pattern.toString();
        const binding = this.binding === undefined ? '' : `as ${this.binding} `;
        return `${pattern} ${binding}=> ${this.to.toString()}`;
    }
}
export class MatchExpression implements ExpressionBase {
    readonly type = 'match';

    readonly underlying = 'expression';

    readonly of: Expression;

    readonly arms: readonly MatchArm[];

    constructor(of: Expression, arms: readonly MatchArm[]) {
        this.of = of;
        this.arms = arms;
    }

    toString(): string {
        const arms = this.arms.map((a) => a.toString()).join(', ');
        return `match ${this.of.toString()} { ${arms} }`;
    }
}

export class ScopeExpression implements ExpressionBase {
    readonly type = 'scope';

    readonly underlying = 'expression';

    readonly definitions: readonly Definition[];

    readonly expression: Expression;

    constructor(definitions: readonly Definition[], expression: Expression) {
        this.definitions = definitions;
        this.expression = expression;
    }

    toString(): string {
        return `{ ${this.definitions
            .map((d) => `${d.toString()} `)
            .join('')}${this.expression.toString()} }`;
    }
}

export type Definition = StructDefinition | FunctionDefinition | VariableDefinition;

interface DefinitionBase {
    readonly type: Definition['type'];
    toString(): string;
}

export class StructDefinitionField {
    readonly name: string;

    readonly type: Expression;

    constructor(name: string, type: Expression) {
        assertValidStructFieldName(name);
        this.name = name;
        this.type = type;
    }
}
export class StructDefinition implements DefinitionBase {
    readonly type = 'struct';

    readonly name: string;

    readonly fields: readonly StructDefinitionField[];

    constructor(name: string, fields: readonly StructDefinitionField[] = []) {
        assertValidStructName(name);
        this.name = name;
        this.fields = fields;
    }

    toString(): string {
        if (this.fields.length === 0) return `struct ${this.name};`;
        return `struct ${this.name} { ${this.fields
            .map((f) => `${f.name}: ${f.type.toString()}`)
            .join(', ')} }`;
    }
}

export class FunctionDefinitionParameter {
    readonly name: string;

    readonly type: Expression;

    constructor(name: string, type: Expression) {
        assertValidStructFieldName(name);
        this.name = name;
        this.type = type;
    }
}
export class FunctionDefinition implements DefinitionBase {
    readonly type = 'function';

    readonly name: string;

    readonly parameters: readonly FunctionDefinitionParameter[];

    readonly value: Expression;

    constructor(
        name: string,
        parameters: readonly FunctionDefinitionParameter[],
        value: Expression
    ) {
        assertValidStructName(name);
        this.name = name;
        this.parameters = parameters;
        this.value = value;
    }

    toString(): string {
        const params = `(${this.parameters
            .map((p) => `${p.name}: ${p.type.toString()}`)
            .join(', ')})`;
        const value =
            this.value.type === 'scope' ? this.value.toString() : `= ${this.value.toString()};`;
        return `def ${this.name}${params} ${value}`;
    }
}

export class VariableDefinition implements DefinitionBase {
    readonly type = 'variable';

    readonly name: string;

    readonly value: Expression;

    constructor(name: string, value: Expression) {
        assertValidStructName(name);
        this.name = name;
        this.value = value;
    }

    toString(): string {
        return `let ${this.name} = ${this.value.toString()};`;
    }
}
