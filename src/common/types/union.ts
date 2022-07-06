/* eslint-disable no-continue */
import { assertNever, sameNumber } from '../util';
import { canonicalize } from './canonical';
import {
    AnyType,
    CanonicalTypes,
    IntIntervalType,
    IntervalType,
    NeverType,
    NonTrivialType,
    NumberPrimitive,
    NumberType,
    NumericLiteralType,
    StringLiteralType,
    StringPrimitive,
    StringType,
    StructType,
    StructTypeField,
    Type,
    UnionType,
    ValueType,
} from './types';
import { isSameStructType } from './util';

type NonEmptyArray<T> = [T, ...T[]];

const unionLiteralNumber = (
    a: NumericLiteralType,
    b: NumericLiteralType | IntervalType | IntIntervalType
): NumberPrimitive | undefined => {
    if (b.type === 'literal') {
        if (sameNumber(a.value, b.value)) return a;

        if (Number.isInteger(a.value) && Number.isInteger(b.value)) {
            const min = Math.min(a.value, b.value);
            const max = Math.max(a.value, b.value);
            if (min + 1 === max) return new IntIntervalType(min, max);
        }
        return undefined;
    }

    if (b.has(a.value)) return b;

    if (b.type === 'int-interval' && Number.isInteger(a.value)) {
        if (a.value === b.min - 1) return new IntIntervalType(b.min - 1, b.max);
        if (a.value === b.max + 1) return new IntIntervalType(b.min, b.max + 1);
    }

    if (
        Number.isNaN(a.value) &&
        b.type === 'interval' &&
        b.min === -Infinity &&
        b.max === Infinity
    ) {
        return NumberType.instance;
    }

    return undefined;
};

const unionIntInterval = (
    a: IntIntervalType,
    b: IntervalType | IntIntervalType
): NumberPrimitive | NonEmptyArray<NumberPrimitive> | undefined => {
    if (b.type === 'int-interval') {
        const minMin = Math.min(a.min, b.min);
        const maxMin = Math.max(a.min, b.min);
        const minMax = Math.min(a.max, b.max);
        const maxMax = Math.max(a.max, b.max);

        if (maxMin - 1 > minMax) return undefined;
        return new IntIntervalType(minMin, maxMax);
    }

    // the interval completely contains the int interval
    if (b.min <= a.min && a.max <= b.max) return b;

    // the two intervals are disjoint
    if (b.max < a.min || a.max < b.min) return undefined;

    const bIntMin = Math.ceil(b.min);
    const bIntMax = Math.floor(b.max);

    // the interval contains no integers
    if (bIntMin > bIntMax) return undefined;

    // we now know that the two intervals have at least one integer in common
    const leftMax = bIntMin - 1;
    const rightMin = bIntMax + 1;

    const result: NonEmptyArray<NumberPrimitive> = [b];

    if (a.min === leftMax) result.push(new NumericLiteralType(leftMax));
    else if (a.min < leftMax) result.push(new IntIntervalType(a.min, leftMax));

    if (a.max === rightMin) result.push(new NumericLiteralType(rightMin));
    else if (rightMin < a.max) result.push(new IntIntervalType(rightMin, a.max));

    return result;
};

const unionNumber = (
    a: NumberPrimitive,
    b: NumberPrimitive
): NumberPrimitive | NonEmptyArray<NumberPrimitive> | undefined => {
    if (a.type === 'number' || b.type === 'number') return NumberType.instance;

    if (a.type === 'literal') return unionLiteralNumber(a, b);
    if (b.type === 'literal') return unionLiteralNumber(b, a);

    if (a.type === 'int-interval') return unionIntInterval(a, b);
    if (b.type === 'int-interval') return unionIntInterval(b, a);

    if (a.overlaps(b)) {
        const min = Math.min(a.min, b.min);
        const max = Math.max(a.max, b.max);
        return new IntervalType(min, max);
    }
    return undefined;
};

const unionString = (a: StringPrimitive, b: StringPrimitive): StringPrimitive | undefined => {
    if (a.type === 'string' || b.type === 'string') return StringType.instance;

    if (a.value === b.value) return a;
    return undefined;
};

const unionStructField = (a: StructTypeField, b: StructTypeField): StructTypeField => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const type = union(a.type, b.type);
    return new StructTypeField(a.name, type);
};
const unionStruct = (a: StructType, b: StructType): StructType | undefined => {
    if (!isSameStructType(a, b)) return undefined;

    if (a.fields.length === 0) return a;

    const fields: StructTypeField[] = [];
    for (let i = 0; i < a.fields.length; i += 1) {
        const aField = a.fields[i];
        const bField = b.fields[i];

        fields.push(unionStructField(aField, bField));
    }
    return new StructType(a.name, fields);
};

const unionIntoSet = <T>(
    set: T[],
    item: T,
    union: (a: T, b: T) => T | NonEmptyArray<T> | undefined
): void => {
    let didChange = true;
    while (didChange) {
        didChange = false;
        for (let i = 0; i < set.length; i += 1) {
            const setItem = set[i];
            const u = union(setItem, item);
            if (u === undefined) continue;

            set.splice(i, 1);
            didChange = true;

            if (Array.isArray(u)) {
                // eslint-disable-next-line prefer-destructuring, no-param-reassign
                item = u[0];
                for (const v of u.slice(1)) {
                    unionIntoSet(set, v, union);
                }
                break;
            } else {
                // eslint-disable-next-line no-param-reassign
                item = u;
                i -= 1;
            }
        }
    }
    set.push(item);
};

class Union {
    private readonly number: NumberPrimitive[] = [];

    private readonly string: StringPrimitive[] = [];

    private readonly struct: StructType[] = [];

    constructor(items?: CanonicalTypes<ValueType>) {
        if (items) {
            for (const t of items) {
                switch (t.underlying) {
                    case 'number':
                        this.number.push(t);
                        break;
                    case 'string':
                        this.string.push(t);
                        break;
                    case 'struct':
                        this.struct.push(t);
                        break;
                    default:
                        break;
                }
            }
        }
    }

    union(item: ValueType | UnionType): void {
        switch (item.underlying) {
            case 'number':
                unionIntoSet(this.number, item, unionNumber);
                break;
            case 'string':
                unionIntoSet(this.string, item, unionString);
                break;
            case 'struct':
                unionIntoSet(this.struct, item, unionStruct);
                break;
            case 'union':
                for (const t of item.items) {
                    this.union(t);
                }
                break;
            default:
                assertNever(item);
        }
    }

    getResult(): ValueType | NeverType | UnionType {
        const items = canonicalize<ValueType>([...this.number, ...this.string, ...this.struct]);

        if (items.length === 0) return NeverType.instance;
        if (items.length === 1) return items[0];
        return new UnionType(items);
    }
}

export const unionValueTypes = (...types: ValueType[]): ValueType | UnionType | NeverType => {
    if (types.length === 0) return NeverType.instance;
    if (types.length === 1) return types[0];

    const u = new Union();

    for (const t of types) {
        u.union(t);
    }

    return u.getResult();
};

type NonNever<T extends Type> = Exclude<T, NeverType>;
type ClosedValueType<T extends ValueType> =
    | (T extends NumericLiteralType ? NumberPrimitive : never)
    | (T extends IntervalType ? NumberPrimitive : never)
    | (T extends IntIntervalType ? NumberPrimitive : never)
    | (T extends StringLiteralType ? StringPrimitive : never)
    | T;
type Closed<T extends Type> =
    | (T extends NumericLiteralType ? NumberPrimitive | UnionType<NumberPrimitive> : never)
    | (T extends IntervalType ? NumberPrimitive | UnionType<NumberPrimitive> : never)
    | (T extends IntIntervalType ? NumberPrimitive | UnionType<NumberPrimitive> : never)
    | (T extends StringLiteralType ? StringPrimitive | UnionType<StringPrimitive> : never)
    | (T extends UnionType<infer U> ? UnionType<ClosedValueType<U>> : never)
    | T;

type Union2<A extends Type, B extends Type> =
    | Closed<NonNever<A>>
    | Closed<NonNever<B>>
    | (A extends NeverType ? (B extends NeverType ? NeverType : never) : never);
type Union3<A extends Type, B extends Type, C extends Type> = Union2<A, Union2<B, C>>;
type Union4<A extends Type, B extends Type, C extends Type, D extends Type> = Union2<
    A,
    Union2<B, Union2<C, D>>
>;

export function union(): NeverType;
export function union<A extends Type>(a: A): A;
export function union<A extends Type, B extends Type>(a: A, b: B): Union2<A, B>;
export function union<A extends Type, B extends Type, C extends Type>(
    a: A,
    b: B,
    c: C
): Union3<A, B, C>;
export function union<A extends Type, B extends Type, C extends Type, D extends Type>(
    a: A,
    b: B,
    c: C,
    d: D
): Union4<A, B, C, D>;
export function union<T extends Type>(...types: T[]): Closed<T> | NeverType;
// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
export function union(...types: Type[]): Type {
    if (types.length === 0) return NeverType.instance;
    if (types.length === 1) return types[0];

    const items: NonTrivialType[] = [];
    let startUnionIndex = -1;
    for (const t of types) {
        if (t.type === 'any') return AnyType.instance;
        if (t.type === 'never') continue;

        if (t.type === 'union') startUnionIndex = items.length;

        items.push(t);
    }

    if (items.length === 0) return NeverType.instance;
    if (items.length === 1) return items[0];

    let u: Union;
    if (startUnionIndex !== -1) {
        u = new Union((items[startUnionIndex] as UnionType).items);
        items.splice(startUnionIndex, 1);
    } else {
        u = new Union();
    }

    for (const t of items) {
        u.union(t);
    }

    return u.getResult();
}
