/* eslint-disable no-continue */
import { Type, ValueType } from '@chainner/navi';
import { assertNever } from '../util';

export const prettyPrintType = (type: Type): string => {
    switch (type.type) {
        case 'any':
        case 'never':
        case 'literal':
        case 'number':
        case 'string':
        case 'interval':
            return type.toString();

        case 'inverted-set':
            return `not(${[...type.excluded].map((s) => JSON.stringify(s)).join(' | ')})`;

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

        case 'union': {
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
        }

        case 'struct':
            if (type.fields.length === 0) return type.name;
            return `${type.name} { ${type.fields
                .map((f) => `${f.name}: ${prettyPrintType(f.type)}`)
                .join(', ')} }`;

        default:
            return assertNever(type);
    }
};
