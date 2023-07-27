/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-continue */
import {
    NumberPrimitive,
    StringPrimitive,
    StructValueType,
    Type,
    UnionType,
    ValueType,
} from '@chainner/navi';
import { assertNever } from '../util';

const prettyPrintNumber = (type: NumberPrimitive): string => {
    switch (type.type) {
        case 'literal':
        case 'number':
        case 'interval':
        case 'non-int-interval':
            return type.toString();

        case 'int-interval':
            if (type.min === -Infinity && type.max === Infinity) {
                return 'int';
            }
            if (type.min === 0 && type.max === Infinity) {
                return 'uint';
            }
            if (type.min + 1 === type.max) {
                return `${type.min} | ${type.max}`;
            }
            return type.toString();

        default:
            return assertNever(type);
    }
};
const prettyPrintString = (type: StringPrimitive): string => {
    switch (type.type) {
        case 'literal':
        case 'string':
            return type.toString();

        case 'inverted-set':
            return `not(${[...type.excluded].map((s) => JSON.stringify(s)).join(' | ')})`;

        default:
            return assertNever(type);
    }
};
const prettyPrintStruct = (type: StructValueType): string => {
    switch (type.type) {
        case 'instance': {
            if (type.fields.length === 0) return type.descriptor.name;
            const fields = type.descriptor.fields
                .map((f, i) => `${f.name}: ${prettyPrintType(type.fields[i])}`)
                .join(', ');
            return `${type.descriptor.name} { ${fields} }`;
        }
        case 'inverted-set':
            return `not(${[...type.excluded].map((s) => s.name).join(' | ')})`;

        case 'struct':
            return type.toString();

        default:
            return assertNever(type);
    }
};
const prettyPrintUnion = (type: UnionType): string => {
    const literals: number[] = [];
    const other: ValueType[] = [];
    for (const item of type.items) {
        if (item.underlying === 'number') {
            if (item.type === 'literal' && Number.isFinite(item.value)) {
                literals.push(item.value);
                continue;
            }
            if (item.type === 'int-interval' && item.min + 1 === item.max) {
                literals.push(item.min);
                literals.push(item.max);
                continue;
            }
        }
        other.push(item);
    }

    const union = [...literals, ...other.map(prettyPrintType)].join(' | ');

    // hacky way to detect boolean
    if (union === 'false | true') return 'bool';

    return union;
};
export const prettyPrintType = (type: Type): string => {
    switch (type.underlying) {
        case 'any':
        case 'never':
            return type.toString();
        case 'number':
            return prettyPrintNumber(type);
        case 'string':
            return prettyPrintString(type);
        case 'struct':
            return prettyPrintStruct(type);
        case 'union':
            return prettyPrintUnion(type);
        default:
            return assertNever(type);
    }
};
