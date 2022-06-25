/* eslint-disable no-continue */
import { assertNever, sameNumber } from '../util';
import {
    AnyType,
    IntIntervalType,
    IntervalType,
    NeverType,
    NumberPrimitive,
    NumericLiteralType,
    StringPrimitive,
    StructType,
    StructTypeField,
    Type,
    UnionType,
    ValueType,
} from './types';
import { unionValueTypes } from './union';
import { groupByUnderlying, isSameStructType } from './util';

const intersectInterval = (
    a: IntervalType | IntIntervalType,
    b: IntervalType | IntIntervalType
): NumberPrimitive | NeverType => {
    const isInt = a.type === 'int-interval' || b.type === 'int-interval';

    let min = Math.max(a.min, b.min);
    let max = Math.min(a.max, b.max);

    if (isInt) {
        min = Math.ceil(min);
        max = Math.floor(max);
    }

    if (min === max) return new NumericLiteralType(min);
    if (min < max) {
        if (isInt) {
            return new IntIntervalType(min, max);
        }
        return new IntervalType(min, max);
    }
    return NeverType.instance;
};
const intersectNumericLiteral = (
    literal: NumericLiteralType,
    other: NumericLiteralType | IntervalType | IntIntervalType
): NumberPrimitive | NeverType => {
    switch (other.type) {
        case 'interval':
        case 'int-interval':
            if (other.has(literal.value)) return literal;
            return NeverType.instance;
        case 'literal':
            if (sameNumber(literal.value, other.value)) {
                return literal;
            }
            return NeverType.instance;

        default:
            return assertNever(other);
    }
};

const intersectNumber = (a: NumberPrimitive, b: NumberPrimitive): NumberPrimitive | NeverType => {
    if (a.type === 'number') return b;
    if (b.type === 'number') return a;

    if (a.type === 'literal') return intersectNumericLiteral(a, b);
    if (b.type === 'literal') return intersectNumericLiteral(b, a);

    return intersectInterval(a, b);
};

const intersectString = (a: StringPrimitive, b: StringPrimitive): StringPrimitive | NeverType => {
    if (a.type === 'string') return b;
    if (b.type === 'string') return a;

    if (a.value === b.value) return a;
    return NeverType.instance;
};

const intersectStruct = (a: StructType, b: StructType): StructType | NeverType => {
    if (!isSameStructType(a, b)) return NeverType.instance;
    if (a.fields.length === 0) return a;

    const items: StructTypeField[] = [];
    for (let i = 0; i < a.fields.length; i += 1) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const t = intersect(a.fields[i].type, b.fields[i].type);
        if (t.type === 'never') return NeverType.instance;
        items.push(new StructTypeField(a.fields[i].name, t));
    }
    return new StructType(a.name, items);
};

const reduceValues = <T extends Type>(
    primitives: readonly T[],
    reducer: (a: T, b: T) => T | NeverType
): T | NeverType | AnyType => {
    if (primitives.length === 0) return AnyType.instance;
    if (primitives.length === 1) return primitives[0];

    let acc: T = primitives[0];
    for (let i = 1; i < primitives.length; i += 1) {
        const n = reducer(acc, primitives[i]);
        if (n.type === 'never') return NeverType.instance;
        acc = n;
    }
    return acc;
};

const intersect2ValueTypes = (a: ValueType, b: ValueType): ValueType | NeverType => {
    if (a.underlying !== b.underlying) return NeverType.instance;

    switch (a.underlying) {
        case 'number':
            return intersectNumber(a, b as NumberPrimitive);
        case 'string':
            return intersectString(a, b as StringPrimitive);
        case 'struct':
            return intersectStruct(a, b as StructType);
        default:
            return assertNever(a);
    }
};

const intersectionOfUnionsToUnionOfIntersections = (
    startValue: ValueType | AnyType,
    intersectionOfUnions: UnionType[]
): Type => {
    if (intersectionOfUnions.length === 0) return startValue;
    if (intersectionOfUnions.length === 1 && startValue.type === 'any')
        return intersectionOfUnions[0];

    let sum: readonly ValueType[];
    if (startValue.type !== 'any') {
        sum = [startValue];
    } else {
        sum = intersectionOfUnions.pop()!.items;
    }

    for (const u of intersectionOfUnions) {
        // multiple the current sum with the current union
        const newSum: ValueType[] = [];
        for (const sValue of sum) {
            for (const uValue of u.items) {
                const i = intersect2ValueTypes(sValue, uValue);
                if (i.type !== 'never') {
                    newSum.push(i);
                }
            }
        }
        sum = newSum;
    }

    return unionValueTypes(...sum);
};

type InternalIntersectionItem = ValueType | UnionType;

const performIntersection = (items: readonly InternalIntersectionItem[]): Type => {
    const groups = groupByUnderlying(items);

    // number, string, and tuple are all mutually exclusive types.
    // If we find at least two elements of different underlying types, we can return never
    if (
        Math.max(groups.number.length, groups.string.length, groups.struct.length) !==
        groups.number.length + groups.string.length + groups.struct.length
    ) {
        return NeverType.instance;
    }

    const values: ValueType[] = [];

    const numberPrimitive = reduceValues(groups.number, intersectNumber);
    if (numberPrimitive.type === 'never') return NeverType.instance;
    if (numberPrimitive.type !== 'any') values.push(numberPrimitive);

    const stringPrimitive = reduceValues(groups.string, intersectString);
    if (stringPrimitive.type === 'never') return NeverType.instance;
    if (stringPrimitive.type !== 'any') values.push(stringPrimitive);

    const struct = reduceValues(groups.struct, intersectStruct);
    if (struct.type === 'never') return NeverType.instance;
    if (struct.type !== 'any') values.push(struct);

    if (values.length > 1) return NeverType.instance;

    return intersectionOfUnionsToUnionOfIntersections(values[0] ?? AnyType.instance, groups.union);
};

export const intersect = (...types: Type[]): Type => {
    const items: InternalIntersectionItem[] = [];
    for (const t of types) {
        if (t.type === 'never') return NeverType.instance;
        if (t.type === 'any') continue;

        items.push(t);
    }

    if (items.length === 0) return AnyType.instance;
    if (items.length === 1) return items[0];

    return performIntersection(items);
};
