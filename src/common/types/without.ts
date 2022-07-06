import { assertNever, sameNumber } from '../util';
import { groupByUnderlying, intInterval, interval, literal } from './type-util';
import {
    AnyType,
    IntIntervalType,
    IntervalType,
    NeverType,
    NumberPrimitive,
    NumberType,
    NumericLiteralType,
    PrimitiveType,
    StringPrimitive,
    StringType,
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

const withoutPrimitive = (
    left: WithoutLhs<ValueType>,
    right: PrimitiveType
): WithoutResult<ValueType> => {
    const groups = groupByUnderlying(left.type === 'union' ? left.items : [left]);

    const other: WithoutResult<PrimitiveType>[] = [];
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
export const without = (
    left: Type,
    right: AnyType | NeverType | PrimitiveType | UnionType<PrimitiveType>
): Type => {
    if (right.type === 'never') return left;
    if (right.type === 'any') return NeverType.instance;
    if (left.type === 'never') return NeverType.instance;
    if (left.type === 'any') return AnyType.instance;

    if (right.underlying === 'number' || right.underlying === 'string') {
        return withoutPrimitive(left, right);
    }

    let result: WithoutResult<ValueType> = left;
    for (const r of right.items) {
        if (result.type === 'never') return NeverType.instance;
        result = withoutPrimitive(result, r);
    }
    return result;
};
