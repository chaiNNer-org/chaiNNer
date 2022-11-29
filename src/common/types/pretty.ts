import { Type } from '@chainner/navi';
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
            return type.toString();

        case 'union':
            return type.items.map(prettyPrintType).join(' | ');

        case 'struct':
            if (type.fields.length === 0) return type.name;
            return `${type.name} { ${type.fields
                .map((f) => `${f.name}: ${prettyPrintType(f.type)}`)
                .join(', ')} }`;

        default:
            return assertNever(type);
    }
};
