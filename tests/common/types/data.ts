import {
    Expression,
    IntersectionExpression,
    UnionExpression,
} from '../../../src/common/types/expression';
import {
    AnyType,
    IntIntervalType,
    IntervalType,
    NeverType,
    NumberType,
    NumericLiteralType,
    StringLiteralType,
    StringType,
    StructType,
    Type,
} from '../../../src/common/types/types';

const addExpressions = (expressions: readonly Expression[]): Expression[] => {
    const newExpressions: Expression[] = [...expressions];

    for (const a of expressions) {
        for (const b of expressions) {
            newExpressions.push(new UnionExpression([a, b]));
        }
    }

    for (const a of expressions) {
        for (const b of expressions) {
            newExpressions.push(new IntersectionExpression([a, b]));
        }
    }

    return newExpressions;
};

export const types: readonly Type[] = [
    NeverType.instance,
    AnyType.instance,

    // number
    NumberType.instance,
    new NumericLiteralType(-2),
    new NumericLiteralType(-1),
    new NumericLiteralType(0),
    new NumericLiteralType(1),
    new NumericLiteralType(2),
    new NumericLiteralType(10),
    new NumericLiteralType(100),
    new NumericLiteralType(-Infinity),
    new NumericLiteralType(Infinity),
    new NumericLiteralType(NaN),
    new IntervalType(0, 1),
    new IntervalType(0, 2),
    new IntervalType(1, 2),
    new IntervalType(0, Infinity),
    new IntervalType(1, Infinity),
    new IntervalType(-Infinity, 0),
    new IntervalType(-Infinity, Infinity),
    new IntIntervalType(0, 1),
    new IntIntervalType(0, 2),
    new IntIntervalType(1, 2),
    new IntIntervalType(0, Infinity),
    new IntIntervalType(1, Infinity),
    new IntIntervalType(-Infinity, 0),
    new IntIntervalType(-Infinity, Infinity),

    // string
    StringType.instance,
    new StringLiteralType(''),
    new StringLiteralType('foo'),
    new StringLiteralType('bar'),

    // struct
    new StructType('null'),
];

export const expressions: readonly Expression[] = addExpressions(types);
