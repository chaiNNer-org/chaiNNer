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
    StringPrimitive,
    StringType,
    StructType,
    StructTypeField,
    Type,
    UnionType,
    ValueType,
} from './types';
import { isSameStructType, isSameType } from './util';

const unionLiteralNumber = (
    a: NumericLiteralType,
    b: NumericLiteralType | IntervalType | IntIntervalType
): NumericLiteralType | IntervalType | IntIntervalType | undefined => {
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

    return undefined;
};

const unionIntInterval = (
    a: IntIntervalType,
    b: IntervalType | IntIntervalType
): IntervalType | IntIntervalType | undefined => {
    if (b.type === 'interval') {
        if (b.min <= a.min && b.max >= a.min) return b;
        return undefined;
    }

    const minMin = Math.min(a.min, b.min);
    const maxMin = Math.max(a.min, b.min);
    const minMax = Math.min(a.max, b.max);
    const maxMax = Math.max(a.max, b.max);

    if (maxMin - 1 > minMax) return undefined;
    return new IntIntervalType(minMin, maxMax);
};

const unionNumber = (a: NumberPrimitive, b: NumberPrimitive): NumberPrimitive | undefined => {
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

    if (type.type === 'never') {
        throw new Error('Invalid union. The union of 2 non-never cannot be be never.');
    }

    return new StructTypeField(a.name, type);
};
const unionStruct = (a: StructType, b: StructType): StructType | undefined => {
    if (!isSameStructType(a, b)) return undefined;

    if (a.fields.length === 0) return a;

    if (a.fields.length === 1)
        return new StructType(a.name, [unionStructField(a.fields[0], b.fields[0])]);

    const fields: StructTypeField[] = [];
    let hasDifferent = false;
    for (let i = 0; i < a.fields.length; i += 1) {
        const aField = a.fields[i];
        const bField = b.fields[i];

        if (isSameType(aField.type, bField.type)) {
            fields.push(aField);
        } else {
            if (hasDifferent) return undefined;
            hasDifferent = true;
            fields.push(unionStructField(aField, bField));
        }
    }
    return new StructType(a.name, fields);
};

const unionIntoSet = <T>(set: T[], item: T, union: (a: T, b: T) => T | undefined): void => {
    let didChange = true;
    while (didChange) {
        didChange = false;
        for (let i = 0; i < set.length; i += 1) {
            const setItem = set[i];
            const u = union(setItem, item);
            if (u) {
                // eslint-disable-next-line no-param-reassign
                item = u;
                set.splice(i, 1);
                i -= 1;
                didChange = true;
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

export const union = (...types: Type[]): Type => {
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
};
