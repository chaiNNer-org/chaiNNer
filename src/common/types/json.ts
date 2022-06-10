import { assertNever } from '../util';
import {
    Expression,
    IntersectionExpression,
    NamedExpression,
    NamedExpressionField,
    UnionExpression,
} from './expression';
import {
    AnyType,
    IntIntervalType,
    IntervalType,
    NeverType,
    NumberType,
    NumericLiteralType,
    StringLiteralType,
    StringType,
} from './types';

export type NumberJson = number | 'inf' | '-inf' | 'NaN';

export type ExpressionJson =
    | string
    | TypeJson
    | UnionExpressionJson
    | IntersectionExpressionJson
    | NamedExpressionJson;
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
    fields: Record<string, ExpressionJson>;
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
        case 'named':
            return {
                type: 'named',
                name: e.name,
                fields: Object.fromEntries(e.fields.map((f) => [e.name, toJson(f.type)])),
            };
        default:
            return assertNever(e);
    }
};

export const fromJson = (e: ExpressionJson): Expression => {
    if (typeof e === 'string') {
        switch (e) {
            case 'any':
                return AnyType.instance;
            case 'never':
                return NeverType.instance;
            case 'number':
                return NumberType.instance;
            case 'string':
                return StringType.instance;
            default:
                return new NamedExpression(e);
        }
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
            return new NamedExpression(
                e.name,
                Object.entries(e.fields).map(
                    ([name, type]) => new NamedExpressionField(name, fromJson(type))
                )
            );
        default:
            return assertNever(e);
    }
};
