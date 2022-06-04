import { Comparator, binaryCompare, compareNumber, compareSequences } from '../util';
import { CanonicalTypes, Type, WithType, WithUnderlying } from './types';

const numberOrder: readonly WithUnderlying<'number'>['type'][] = [
    'literal',
    'int-interval',
    'interval',
    'number',
];
const stringOrder: readonly WithUnderlying<'string'>['type'][] = ['literal', 'string'];
const underlyingOrder: readonly Type['underlying'][] = [
    'never',
    'any',
    'number',
    'string',
    'struct',
    'union',
];

const numberComparators: {
    [key in WithUnderlying<'number'>['type']]: Comparator<WithType<key, WithUnderlying<'number'>>>;
} = {
    number: () => 0,
    literal: (a, b) => compareNumber(a.value, b.value),
    'int-interval': (a, b) => compareNumber(a.min, b.min) || compareNumber(a.max, b.max),
    interval: (a, b) => compareNumber(a.min, b.min) || compareNumber(a.max, b.max),
};
const stringComparators: {
    [key in WithUnderlying<'string'>['type']]: Comparator<WithType<key, WithUnderlying<'string'>>>;
} = {
    string: () => 0,
    literal: (a, b) => binaryCompare(a.value, b.value),
};
const comparators: {
    [key in Type['underlying']]: Comparator<WithUnderlying<key>>;
} = {
    never: () => 0,
    any: () => 0,
    number: (a, b) => {
        if (a.type !== b.type) {
            return numberOrder.indexOf(a.type) - numberOrder.indexOf(b.type);
        }
        return numberComparators[a.type](a as never, b as never);
    },
    string: (a, b) => {
        if (a.type !== b.type) {
            return stringOrder.indexOf(a.type) - stringOrder.indexOf(b.type);
        }
        return stringComparators[a.type](a as never, b as never);
    },
    struct: (a, b) => {
        if (a.fields.length !== b.fields.length) return a.fields.length - b.fields.length;
        return binaryCompare(a.name, b.name);
    },
    union: (a, b) => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return compareSequences(a.items, b.items, compareTypes);
    },
};

const compareTypes = (a: Type, b: Type): number => {
    if (a.underlying !== b.underlying) {
        return underlyingOrder.indexOf(a.underlying) - underlyingOrder.indexOf(b.underlying);
    }

    return comparators[a.underlying](a as never, b as never);
};

export const canonicalize = <T extends Type>(types: readonly T[]): CanonicalTypes<T> => {
    const result: T[] = [];

    // de-dup
    const seen = new Set<string>();
    for (const t of types) {
        const key = t.getTypeId();
        if (!seen.has(key)) {
            seen.add(key);
            result.push(t);
        }
    }

    // sort
    result.sort(compareTypes);

    return result as unknown as CanonicalTypes<T>;
};
