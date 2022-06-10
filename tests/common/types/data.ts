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
    StructTypeField,
    Type,
} from '../../../src/common/types/types';

const addExpressions = (expressions: readonly Expression[]): Expression[] => {
    const newExpressions: Expression[] = [...expressions];

    for (let i = 0; i < expressions.length; i += 1) {
        const a = expressions[i];
        for (let j = i + 1; j < expressions.length; j += 1) {
            const b = expressions[j];
            newExpressions.push(new UnionExpression([a, b]));
        }
    }

    for (let i = 0; i < expressions.length; i += 1) {
        const a = expressions[i];
        for (let j = i + 1; j < expressions.length; j += 1) {
            const b = expressions[j];
            newExpressions.push(new IntersectionExpression([a, b]));
        }
    }

    return newExpressions;
};

const primitives: readonly Type[] = [
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
    new IntervalType(0.5, 1.5),
    new IntervalType(0.5, 2.5),
    new IntervalType(0.5, 0.75),
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

    new StructType('null'),
];
const structs: readonly Type[] = [
    new StructType('Foo', [
        new StructTypeField('a', new NumericLiteralType(1)),
        new StructTypeField('b', new NumericLiteralType(2)),
    ]),
    new StructType('Foo', [
        new StructTypeField('a', new NumericLiteralType(3)),
        new StructTypeField('b', new NumericLiteralType(2)),
    ]),
    new StructType('Foo', [
        new StructTypeField('a', new NumericLiteralType(3)),
        new StructTypeField('b', new NumericLiteralType(4)),
    ]),
    new StructType('Foo', [
        new StructTypeField('a', new NumericLiteralType(3)),
        new StructTypeField('b', NumberType.instance),
    ]),
];

export const types: readonly Type[] = [...primitives, ...structs];

export const expressions: readonly Expression[] = [
    ...addExpressions(primitives),
    ...addExpressions(structs),
];
