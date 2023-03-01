import {
    Expression,
    FieldAccessExpression,
    FunctionCallExpression,
    IntIntervalType,
    IntersectionExpression,
    IntervalType,
    MatchArm,
    MatchExpression,
    NamedExpression,
    NumericLiteralType,
    SourceDocument,
    StringLiteralType,
    StructExpression,
    StructExpressionField,
    UnionExpression,
    parseExpression,
} from '@chainner/navi';
import { assertNever } from '../util';

export type NumberJson = number | 'inf' | '-inf' | 'NaN';

export type ExpressionJson =
    | boolean
    | string
    | number
    | TypeJson
    | ExpressionJson[]
    | UnionExpressionJson
    | IntersectionExpressionJson
    | NamedExpressionJson
    | FieldAccessExpressionJson
    | FunctionCallExpressionJson
    | MatchExpressionJson;
export type TypeJson = PrimitiveTypeJson | 'never' | 'any';
export type PrimitiveTypeJson = NumberPrimitiveJson | StringPrimitiveJson;
export type NumberPrimitiveJson =
    | 'number'
    | NumericLiteralTypeJson
    | IntervalTypeJson
    | IntIntervalTypeJson;
export type StringPrimitiveJson = 'string' | StringLiteralTypeJson;

export interface NumericLiteralTypeJson {
    type: 'numeric-literal';
    value: NumberJson;
}
export interface IntervalTypeJson {
    type: 'interval';
    min: NumberJson;
    max: NumberJson;
}
export interface IntIntervalTypeJson {
    type: 'int-interval';
    min: NumberJson;
    max: NumberJson;
}
export interface StringLiteralTypeJson {
    type: 'string-literal';
    value: string;
}

export interface UnionExpressionJson {
    type: 'union';
    items: ExpressionJson[];
}
export interface IntersectionExpressionJson {
    type: 'intersection';
    items: ExpressionJson[];
}
export interface NamedExpressionJson {
    type: 'named';
    name: string;
    fields?: Record<string, ExpressionJson> | null;
}
export interface FieldAccessExpressionJson {
    type: 'field-access';
    field: string;
    of: ExpressionJson;
}
export interface FunctionCallExpressionJson {
    type: 'function-call';
    name: string;
    args: ExpressionJson[];
}
export interface MatchArmJson {
    pattern: ExpressionJson;
    binding?: string | null;
    to: ExpressionJson;
}
export interface MatchExpressionJson {
    type: 'match';
    of: ExpressionJson;
    arms: MatchArmJson[];
}

const toNumberJson = (number: number): NumberJson => {
    if (Number.isNaN(number)) return 'NaN';
    if (number === Infinity) return 'inf';
    if (number === -Infinity) return '-inf';
    return number;
};
const fromNumberJson = (number: NumberJson): number => {
    if (number === 'NaN') return NaN;
    if (number === 'inf') return Infinity;
    if (number === '-inf') return -Infinity;
    return number;
};

export const toJson = (e: Expression): ExpressionJson => {
    switch (e.type) {
        case 'any':
            return 'any';
        case 'never':
            return 'never';
        case 'number':
            return 'number';
        case 'string':
            return 'string';
        case 'interval':
            return { type: 'interval', min: toNumberJson(e.min), max: toNumberJson(e.max) };
        case 'int-interval':
            return { type: 'int-interval', min: toNumberJson(e.min), max: toNumberJson(e.max) };
        case 'literal':
            if (e.underlying === 'number') {
                return { type: 'numeric-literal', value: toNumberJson(e.value) };
            }
            return { type: 'string-literal', value: e.value };
        case 'union':
            return { type: 'union', items: e.items.map(toJson) };
        case 'intersection':
            return { type: 'intersection', items: e.items.map(toJson) };
        case 'struct':
            return {
                type: 'named',
                name: e.name,
                fields: Object.fromEntries(e.fields.map((f) => [e.name, toJson(f.type)])),
            };
        case 'named':
            return {
                type: 'named',
                name: e.name,
            };
        case 'field-access':
            return { type: 'field-access', of: toJson(e.of), field: e.field };
        case 'function-call':
            return { type: 'function-call', name: e.functionName, args: e.args.map(toJson) };
        case 'match': {
            return {
                type: 'match',
                of: toJson(e.of),
                arms: e.arms.map((a) => ({
                    pattern: toJson(a.pattern),
                    binding: a.binding,
                    to: toJson(a.to),
                })),
            };
        }
        case 'scope':
            throw new Error('Converting scoped expressions to JSON is currently not supported.');
        case 'inverted-set':
            throw new Error('Converting scoped expressions to JSON is currently not supported.');
        default:
            return assertNever(e);
    }
};

export const fromJson = (e: ExpressionJson): Expression => {
    if (typeof e === 'boolean') {
        return new NamedExpression(e ? 'true' : 'false');
    }
    if (typeof e === 'number') {
        return new NumericLiteralType(e);
    }
    if (typeof e === 'string') {
        return parseExpression(new SourceDocument(e, 'unnamed JSON'));
    }

    if (Array.isArray(e)) {
        return new UnionExpression(e.map(fromJson));
    }

    switch (e.type) {
        case 'numeric-literal':
            return new NumericLiteralType(fromNumberJson(e.value));
        case 'string-literal':
            return new StringLiteralType(e.value);
        case 'interval':
            return new IntervalType(fromNumberJson(e.min), fromNumberJson(e.max));
        case 'int-interval':
            return new IntIntervalType(fromNumberJson(e.min), fromNumberJson(e.max));
        case 'union':
            return new UnionExpression(e.items.map(fromJson));
        case 'intersection':
            return new IntersectionExpression(e.items.map(fromJson));
        case 'named':
            if (Object.keys(e.fields ?? {}).length === 0) {
                return new NamedExpression(e.name);
            }
            return new StructExpression(
                e.name,
                Object.entries(e.fields ?? {}).map(
                    ([name, type]) => new StructExpressionField(name, fromJson(type))
                )
            );
        case 'field-access':
            return new FieldAccessExpression(fromJson(e.of), e.field);
        case 'function-call':
            return new FunctionCallExpression(e.name, e.args.map(fromJson));
        case 'match':
            return new MatchExpression(
                fromJson(e.of),
                e.arms.map(({ pattern, binding, to }) => {
                    return new MatchArm(fromJson(pattern), binding ?? undefined, fromJson(to));
                })
            );
        default:
            return assertNever(e);
    }
};
