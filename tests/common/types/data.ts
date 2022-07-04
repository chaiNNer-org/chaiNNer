import {
    Expression,
    FieldAccessExpression,
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
import { union } from '../../../src/common/types/union';

export const orderedPairs = <T>(array: readonly T[]): [T, T][] => {
    return array.flatMap((a) => array.map<[T, T]>((b) => [a, b]));
};
export const unorderedPairs = <T>(array: readonly T[]): [T, T][] => {
    const result: [T, T][] = [];
    for (let i = 0; i < array.length; i += 1) {
        const a = array[i];
        for (let j = i + 1; j < array.length; j += 1) {
            const b = array[j];
            result.push([a, b]);
        }
    }
    return result;
};

const addExpressions = (expressions: readonly Expression[]): Expression[] => {
    return [
        ...expressions,
        ...unorderedPairs(expressions).map((items) => new UnionExpression(items)),
        ...unorderedPairs(expressions).map((items) => new IntersectionExpression(items)),
    ];
};
const fieldAccess = (expressions: readonly Expression[]): Expression[] => {
    return expressions.map((e) => new FieldAccessExpression(e, 'a'));
};

export const sets: readonly Type[] = [NeverType.instance, AnyType.instance];
export const numbers: readonly Type[] = [
    NumberType.instance,
    new NumericLiteralType(-3.14),
    new NumericLiteralType(-2),
    new NumericLiteralType(-1),
    new NumericLiteralType(0),
    new NumericLiteralType(0.5),
    new NumericLiteralType(1),
    new NumericLiteralType(2),
    new NumericLiteralType(2.78),
    new NumericLiteralType(3.14),
    new NumericLiteralType(10),
    new NumericLiteralType(100),
    new NumericLiteralType(-Infinity),
    new NumericLiteralType(Infinity),
    new NumericLiteralType(NaN),
    new IntervalType(0, 1),
    new IntervalType(0, 2),
    new IntervalType(0.5, 1.5),
    new IntervalType(0.5, 2.5),
    new IntervalType(-2.56, 3.35),
    new IntervalType(0.5, 0.75),
    new IntervalType(1, 2),
    new IntervalType(0, Infinity),
    new IntervalType(1, Infinity),
    new IntervalType(2, Infinity),
    new IntervalType(2.5, Infinity),
    new IntervalType(-Infinity, 0),
    new IntervalType(-Infinity, Infinity),
    new IntIntervalType(0, 1),
    new IntIntervalType(0, 2),
    new IntIntervalType(1, 2),
    new IntIntervalType(0, Infinity),
    new IntIntervalType(1, Infinity),
    new IntIntervalType(-Infinity, 0),
    new IntIntervalType(-Infinity, 1),
    new IntIntervalType(-Infinity, Infinity),
];
export const strings: readonly Type[] = [
    StringType.instance,
    new StringLiteralType(''),
    new StringLiteralType('foo'),
    new StringLiteralType('bar'),
    union(new StringLiteralType('foo'), new StringLiteralType('bar')),
    union(new StringLiteralType('foo'), new StringLiteralType('baz')),
];
export const structs: readonly Type[] = [
    new StructType('null'),

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

export const types: readonly Type[] = [...sets, ...numbers, ...strings, ...structs];

export const expressions: readonly Expression[] = [
    ...addExpressions([...sets, ...numbers, ...strings]),
    ...addExpressions(structs),
];

export const potentiallyInvalidExpressions: readonly Expression[] = [
    ...fieldAccess([...sets, ...numbers, ...strings, ...addExpressions(structs)]),
];
