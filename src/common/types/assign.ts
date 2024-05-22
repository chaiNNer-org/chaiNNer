import {
    NeverType,
    NonNeverType,
    NumberPrimitive,
    StringPrimitive,
    Type,
    UnionType,
    intersect,
    isDisjointWith,
} from '@chainner/navi';

export type AssignmentResult = AssignmentOk | AssignmentError;
export interface AssignmentOk {
    readonly isOk: true;
    readonly assignedType: NonNeverType;
}
export interface AssignmentError {
    readonly isOk: false;
    readonly assignedType: NeverType;
    readonly errorType: Type;
}

/**
 * We only want to split if there is at least one specific struct instance or there are no struct instances at all.
 */
const shouldSplit = (items: readonly Type[]): boolean => {
    let noStructs = true;
    for (const item of items) {
        if (item.underlying === 'struct') {
            noStructs = false;
            if (item.type === 'instance') {
                return true;
            }
        }
    }
    return noStructs;
};
const splitType = (t: Type): Type[] => {
    if (t.underlying === 'union' && shouldSplit(t.items)) {
        const numbers: NumberPrimitive[] = [];
        const strings: StringPrimitive[] = [];
        const result: Type[] = [];
        for (const item of t.items) {
            if (item.underlying === 'number') {
                numbers.push(item);
            } else if (item.underlying === 'string') {
                strings.push(item);
            } else {
                result.push(item);
            }
        }

        if (numbers.length === 1) {
            result.push(numbers[0]);
        } else if (numbers.length >= 2) {
            result.push(new UnionType(numbers as never));
        }
        if (strings.length === 1) {
            result.push(strings[0]);
        } else if (strings.length >= 2) {
            result.push(new UnionType(strings as never));
        }
        return result;
    }
    return [t];
};

/**
 * Returns whether the type `t` can be assigned to an input of type `definitionType`.
 */
export const assign = (t: Type, definitionType: Type): AssignmentResult => {
    const split = splitType(t);
    if (split.length > 1) {
        for (const item of split) {
            if (isDisjointWith(item, definitionType)) {
                return { isOk: false, assignedType: NeverType.instance, errorType: item };
            }
        }
    }

    const intersection = intersect(t, definitionType);
    if (intersection.underlying === 'never') {
        return { isOk: false, assignedType: intersection, errorType: t };
    }
    return { isOk: true, assignedType: intersection };
};

/**
 * Equivalent to `assign(t, definitionType).isOk`, but faster.
 */
export const assignOk = (t: Type, definitionType: Type): boolean => {
    return assign(t, definitionType).isOk;
};
