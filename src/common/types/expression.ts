/* eslint-disable max-classes-per-file */
import { assertValidStructFieldName, assertValidStructName } from './names';
import { Type } from './types';

type PureExpression = UnionExpression | IntersectionExpression | StructExpression;

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

export class StructExpressionField {
    readonly name: string;

    readonly type: Expression;

    constructor(name: string, type: Expression) {
        assertValidStructFieldName(name);
        this.name = name;
        this.type = type;
    }
}
export class StructExpression implements ExpressionBase {
    readonly type = 'struct';

    readonly underlying = 'expression';

    readonly fields: readonly StructExpressionField[];

    readonly name: string;

    constructor(name: string, fields: readonly StructExpressionField[] = []) {
        assertValidStructName(name);
        this.name = name;
        this.fields = fields;
    }

    toString(): string {
        if (this.fields.length === 0) return this.name;
        return `${this.name}{ ${this.fields
            .map((f) => `${f.name}: ${f.type.toString()}`)
            .join(', ')} }`;
    }
}
