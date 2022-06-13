import { assertNever } from '../util';
import { Expression } from './expression';
import { StructType, Type, WithUnderlying } from './types';

export type UnderlyingGroup<T extends Type> = {
    [key in Type['underlying']]: WithUnderlying<key, T>[];
};
export const groupByUnderlying = <T extends Type>(types: readonly T[]): UnderlyingGroup<T> => {
    const groups: UnderlyingGroup<T> = {
        never: [],
        any: [],
        number: [],
        string: [],
        struct: [],
        union: [],
    };
    for (const t of types) {
        groups[t.underlying].push(t as never);
    }
    return groups;
};

export const isSameStructType = (a: StructType, b: StructType): boolean => {
    if (a.name !== b.name) return false;

    if (a.fields.length !== b.fields.length) {
        throw new Error(
            'Invalid struct.' +
                ' Expected all structs with the same name to have the same number of fields.' +
                ` a = ${a.getTypeId()} , b = ${b.getTypeId()}`
        );
    }

    if (a.fields.some((f, i) => f.name !== b.fields[i].name)) {
        throw new Error(
            'Invalid struct.' +
                ' Expected all structs with the same name to have the same field names.' +
                ` a = ${a.getTypeId()} , b = ${b.getTypeId()}`
        );
    }

    return true;
};

export const isSameType = (a: Type, b: Type): boolean => a === b || a.getTypeId() === b.getTypeId();

export function* getReferences(expression: Expression): Iterable<string> {
    if (expression.type === 'named') {
        yield expression.name;
    }

    if (expression.underlying === 'expression') {
        switch (expression.type) {
            case 'intersection':
            case 'union':
                for (const e of expression.items) {
                    yield* getReferences(e);
                }
                break;
            case 'named':
                for (const f of expression.fields) {
                    yield* getReferences(f.type);
                }
                break;
            case 'field-access':
                yield* getReferences(expression.of);
                break;
            case 'builtin-function':
                for (const f of expression.args) {
                    yield* getReferences(f);
                }
                break;
            default:
                yield assertNever(expression);
        }
    }
}
