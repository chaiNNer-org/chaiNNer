/* eslint-disable max-classes-per-file */
import {
    assertValidFunctionName,
    assertValidStructFieldName,
    assertValidStructName,
} from './names';
import { isSubsetOf } from './relation';
import { AnyType, NeverType, PrimitiveType, Type, UnionType } from './types';
import { union } from './union';

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

export class MatchArm {
    readonly pattern: string | PrimitiveType | UnionType<PrimitiveType> | AnyType;

    readonly binding: string | undefined;

    readonly to: Expression;

    constructor(pattern: MatchArm['pattern'], binding: string | undefined, to: Expression) {
        if (binding !== undefined) assertValidStructFieldName(binding);
        if (typeof pattern === 'string') assertValidStructName(pattern);
        this.pattern = pattern;
        this.binding = binding;
        this.to = to;
    }

    toString(): string {
        const pattern =
            // eslint-disable-next-line no-nested-ternary
            typeof this.pattern === 'string'
                ? this.pattern
                : this.pattern.type === 'any'
                ? '_'
                : this.pattern.toString();
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

        let total: Type = NeverType.instance;
        const totalStructs = new Set<string>();
        for (const arm of arms) {
            if (typeof arm.pattern === 'string') {
                if (totalStructs.has(arm.pattern)) {
                    throw new Error(
                        `Invalid match expression:` +
                            ` The pattern of the arm \`${arm.toString()}\` is already fully handled by previous arms.` +
                            ` ${this.toString()}`
                    );
                }
                totalStructs.add(arm.pattern);
            } else {
                if (isSubsetOf(arm.pattern, total)) {
                    throw new Error(
                        `Invalid match expression:` +
                            ` The pattern of the arm \`${arm.toString()}\` is already fully handled by previous arms.` +
                            ` ${this.toString()}`
                    );
                }
                total = union(total, arm.pattern);
            }
        }
    }

    toString(): string {
        const arms = this.arms.map((a) => a.toString()).join(', ');
        return `match ${this.of.toString()} { ${arms} }`;
    }
}
