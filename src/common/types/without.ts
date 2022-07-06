import { assertNever, sameNumber } from '../util';
import { isSupersetOf } from './relation';
import { groupByUnderlying, intInterval, interval, isSameStructType, literal } from './type-util';
import {
    AnyType,
    IntIntervalType,
    IntervalType,
    NeverType,
    NumberPrimitive,
    NumberType,
    NumericLiteralType,
    StringPrimitive,
    StringType,
    StructType,
    StructTypeField,
    Type,
    UnionType,
    ValueType,
} from './types';
import { union } from './union';

type WithoutLhs<T extends ValueType> = T | UnionType<T>;
type WithoutResult<T extends ValueType> = T | UnionType<T> | NeverType;

const hasLiteral = (primitive: NumberPrimitive, n: number): boolean => {
    switch (primitive.type) {
        case 'number':
            return true;
        case 'int-interval':
        case 'interval':
            return primitive.has(n);
        case 'literal':
            return sameNumber(primitive.value, n);
        default:
            return assertNever(primitive);
    }
};

const complementNumber = (n: NumberPrimitive): WithoutResult<NumberPrimitive> => {
    switch (n.type) {
        case 'number':
            return NeverType.instance;
        case 'int-interval':
            // `number \ int` is not representable and the closest representable type is `number`
            return NumberType.instance;
        case 'literal':
            if (Number.isNaN(n.value)) {
                return interval(-Infinity, Infinity);
            }
            // except for NaN, the result is not representable
            return NumberType.instance;
        case 'interval': {
            // Note: except for `-Infinity..Infinity`, the result is not representable and will be
            // approximated
            const items: NumberPrimitive[] = [literal(NaN)];
            if (-Infinity < n.min) items.push(interval(-Infinity, n.min));
            if (n.max < Infinity) items.push(interval(n.max, Infinity));
            return union(...items);
        }
        default:
            return assertNever(n);
    }
};
const withoutIntInterval = (
    left: IntIntervalType,
    right: IntIntervalType | IntervalType | NumericLiteralType
): WithoutResult<NumberPrimitive> => {
    // The idea here is to first convert the rhs into what is effectively `int & right`.
    // This means that we only have to implement int-interval without int-interval.

    let rMin: number;
    let rMax: number;
    if (right.type === 'literal') {
        if (!Number.isInteger(right.value)) return left;
        rMin = right.value;
        rMax = right.value;
    } else if (right.type === 'interval') {
        rMin = Math.ceil(right.min);
        rMax = Math.floor(right.max);
        if (rMin > rMax) return left;
    } else {
        rMin = right.min;
        rMax = right.max;
    }

    const items: NumberPrimitive[] = [];

    if (rMax < Infinity) {
        const lower = Math.max(left.min, rMax + 1);
        if (lower <= left.max) items.push(intInterval(lower, left.max));
    }
    if (rMin > -Infinity) {
        const upper = Math.min(left.max, rMin - 1);
        if (left.min <= upper) items.push(intInterval(left.min, upper));
    }

    return union(...items);
};
const withoutInterval = (
    left: IntervalType,
    right: IntIntervalType | IntervalType | NumericLiteralType
): WithoutResult<NumberPrimitive> => {
    if (right.type === 'literal' || right.type === 'int-interval') {
        // The nearest representable type for `left \ right` will always be `left`.
        return left;
    }

    const items: NumberPrimitive[] = [];

    const a = Math.max(left.min, right.max);
    if (a < left.max) items.push(interval(a, left.max));
    const b = Math.min(left.max, right.min);
    if (left.min < b) items.push(interval(left.min, b));

    return union(...items);
};
const withoutNumberPrimitive = (
    left: NumberPrimitive,
    right: NumberPrimitive
): WithoutResult<NumberPrimitive> => {
    if (right.type === 'number') return NeverType.instance;

    if (left.type === 'literal') {
        return hasLiteral(right, left.value) ? NeverType.instance : left;
    }
    if (left.type === 'int-interval') return withoutIntInterval(left, right);

    // the following are only approximate
    if (left.type === 'number') return complementNumber(right);
    return withoutInterval(left, right);
};

const withoutStringPrimitive = (
    left: StringPrimitive,
    right: StringPrimitive
): WithoutResult<StringPrimitive> => {
    if (right.type === 'string') return NeverType.instance;
    if (left.type === 'string') return StringType.instance;

    if (left.value === right.value) return NeverType.instance;

    // disjoint
    return left;
};

const withoutStruct = (left: StructType, right: StructType): StructType | NeverType => {
    if (isSameStructType(left, right)) {
        if (left.fields.length === 0) {
            // there are no fields, so e.g. `null \ null == never`
            return NeverType.instance;
        }
        if (left.fields.length === 1) {
            // if there is only field, we only have to find the difference of that field
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            const field = without(left.fields[0].type, right.fields[0].type);
            if (field.type === 'never') return NeverType.instance;
            return new StructType(left.name, [new StructTypeField(left.fields[0].name, field)]);
        }

        // the condition for multiple fields is as follows:
        // 1. If all right fields are a superset of their corresponding left fields, return never.
        // 2. If there is exactly one right field that is a subset of its corresponding left field
        //    (all other right fields being supersets of their corresponding left fields), then
        //    find the difference for that one field and use the left field for all others.
        // 3. If neither 1) not 2) applies, return left.

        let subset: number | undefined;
        for (let i = 0; i < left.fields.length; i += 1) {
            const leftField = left.fields[i];
            const rightField = right.fields[i];
            if (!isSupersetOf(rightField.type, leftField.type)) {
                if (subset === undefined) {
                    subset = i;
                } else {
                    // there is more than one subset, so condition 3)
                    return left;
                }
            }
        }

        // condition 1)
        if (subset === undefined) return NeverType.instance;

        // condition 2)
        return new StructType(
            left.name,
            left.fields.map((leftField, i) => {
                if (i !== subset) return leftField;

                const rightField = right.fields[i];
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                const diff = without(leftField.type, rightField.type);
                if (diff.type === 'never') {
                    throw new Error(
                        'This should not be possible because the left field is guaranteed to be a strict subset of the right field.' +
                            ' This means that there is a bug with implementation of `without` or `isSubsetOf`.' +
                            ' Please report this as a bug.'
                    );
                }

                return new StructTypeField(leftField.name, diff);
            })
        );
    }
    return left;
};

const withoutValue = (left: WithoutLhs<ValueType>, right: ValueType): WithoutResult<ValueType> => {
    const groups = groupByUnderlying(left.type === 'union' ? left.items : [left]);

    const other: WithoutResult<ValueType>[] = [];
    switch (right.underlying) {
        case 'number': {
            const l = groups.number;
            if (l.length === 0) return left;
            other.push(...l.map((n) => withoutNumberPrimitive(n, right)));
            l.length = 0;
            break;
        }
        case 'string': {
            const l = groups.string;
            if (l.length === 0) return left;
            other.push(...l.map((s) => withoutStringPrimitive(s, right)));
            l.length = 0;
            break;
        }
        case 'struct': {
            const l = groups.struct;
            if (l.length === 0) return left;
            other.push(...l.map((s) => withoutStruct(s, right)));
            l.length = 0;
            break;
        }
        default:
            return assertNever(right);
    }

    return union(...groups.number, ...groups.string, ...groups.struct, ...other);
};

/**
 * Returns the **approximate** result of `left \ right` (set minus/set difference).
 *
 * The result is only approximate because not all results of `left \ right` can be represented
 * using the type system. E.g. `0..1 \ 0.5` is not representable. For unrepresentable results, a
 * superset of the actual result that is representable using the type system will be returned.
 * E.g. `0..1 \ 0.5` will return `0..1`.
 */
export const without = (left: Type, right: Type): Type => {
    if (right.type === 'never') return left;
    if (right.type === 'any') return NeverType.instance;
    if (left.type === 'never') return NeverType.instance;
    if (left.type === 'any') return AnyType.instance;

    if (right.underlying !== 'union') {
        return withoutValue(left, right);
    }

    let result: WithoutResult<ValueType> = left;
    for (const r of right.items) {
        if (result.type === 'never') return NeverType.instance;
        result = withoutValue(result, r);
    }
    return result;
};
