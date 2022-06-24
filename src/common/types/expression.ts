/* eslint-disable max-classes-per-file */
import { assertNever } from '../util';
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
    | BuiltinFunctionExpression
    | MatchExpression;

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

export class BuiltinFunctionExpression implements ExpressionBase {
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

export class MatchStructArm {
    readonly type = 'struct';

    readonly name: string;

    readonly expression: Expression;

    readonly binding: string | undefined;

    constructor(name: string, expression: Expression, binding?: string) {
        assertValidStructName(name);
        if (binding !== undefined) assertValidStructFieldName(binding);
        this.name = name;
        this.expression = expression;
        this.binding = binding;
    }

    toString(): string {
        const binding = this.binding === undefined ? '' : `as ${this.binding} `;
        return `${this.name} ${binding}=> ${this.expression.toString()}`;
    }
}
export class MatchNumberArm {
    readonly type = 'number';

    readonly expression: Expression;

    readonly binding: string | undefined;

    constructor(expression: Expression, binding?: string) {
        if (binding !== undefined) assertValidStructFieldName(binding);
        this.expression = expression;
        this.binding = binding;
    }

    toString(): string {
        const binding = this.binding === undefined ? '' : `as ${this.binding} `;
        return `number ${binding}=> ${this.expression.toString()}`;
    }
}
export class MatchStringArm {
    readonly type = 'string';

    readonly expression: Expression;

    readonly binding: string | undefined;

    constructor(expression: Expression, binding?: string) {
        if (binding !== undefined) assertValidStructFieldName(binding);
        this.expression = expression;
        this.binding = binding;
    }

    toString(): string {
        const binding = this.binding === undefined ? '' : `as ${this.binding} `;
        return `string ${binding}=> ${this.expression.toString()}`;
    }
}
export class MatchDefaultArm {
    readonly type = 'default';

    readonly expression: Expression;

    readonly binding: string | undefined;

    constructor(expression: Expression, binding?: string) {
        if (binding !== undefined) assertValidStructFieldName(binding);
        this.expression = expression;
        this.binding = binding;
    }

    toString(): string {
        const binding = this.binding === undefined ? '' : `as ${this.binding} `;
        return `_ ${binding}=> ${this.expression.toString()}`;
    }
}
export type MatchArm = MatchStructArm | MatchStringArm | MatchNumberArm | MatchDefaultArm;
export class MatchExpression implements ExpressionBase {
    readonly type = 'match';

    readonly underlying = 'expression';

    readonly of: Expression;

    readonly structArms: readonly MatchStructArm[];

    readonly numberArm: MatchNumberArm | undefined;

    readonly stringArm: MatchStringArm | undefined;

    readonly defaultArm: MatchDefaultArm | undefined;

    constructor(of: Expression, arms: readonly MatchArm[]) {
        this.of = of;

        const structs = new Set<string>();
        const structArms: MatchStructArm[] = [];
        for (const arm of arms) {
            switch (arm.type) {
                case 'struct':
                    if (structs.has(arm.name))
                        throw new Error(
                            `Invalid match arms. The struct ${arm.name} is matched twice.`
                        );
                    structs.add(arm.name);
                    structArms.push(arm);
                    break;
                case 'number':
                    if (this.numberArm)
                        throw new Error(
                            `Invalid match arms. There must at most be one number arm.`
                        );
                    this.numberArm = arm;
                    break;
                case 'string':
                    if (this.stringArm)
                        throw new Error(
                            `Invalid match arms. There must at most be one string arm.`
                        );
                    this.stringArm = arm;
                    break;
                case 'default':
                    if (this.defaultArm)
                        throw new Error(
                            `Invalid match arms. There must at most be one default arm.`
                        );
                    this.defaultArm = arm;
                    break;
                default:
                    assertNever(arm);
            }
        }
        this.structArms = structArms;
    }

    toString(): string {
        const all: MatchArm[] = [];
        if (this.numberArm) all.push(this.numberArm);
        if (this.stringArm) all.push(this.stringArm);
        all.push(...this.structArms);
        if (this.defaultArm) all.push(this.defaultArm);

        const arms = all.map((a) => a.toString()).join(', ');
        return `match ${this.of.toString()} { ${arms} }`;
    }
}
