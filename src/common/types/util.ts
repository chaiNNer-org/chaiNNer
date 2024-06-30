import {
    IntIntervalType,
    NonNeverType,
    NumericLiteralType,
    StringPrimitive,
    StructDescriptor,
    StructInstanceType,
    Type,
    UnionType,
    getStructDescriptor,
    intersect,
    isStructInstance,
    without,
} from '@chainner/navi';
import { getChainnerScope } from './chainner-scope';

export type IntNumberType =
    | NumericLiteralType
    | IntIntervalType
    | UnionType<NumericLiteralType | IntIntervalType>;

interface KnownStructDefinitions {
    Image: {
        readonly width: IntNumberType;
        readonly height: IntNumberType;
        readonly channels: IntNumberType;
    };
    Color: {
        readonly channels: IntNumberType;
    };
    Directory: {
        readonly path: StringPrimitive;
    };

    true: Record<string, never>;
    false: Record<string, never>;
}
interface KnownInstance<N extends keyof KnownStructDefinitions> {
    readonly descriptor: StructDescriptor & { readonly name: N };
}
const createAssertFn = <N extends keyof KnownStructDefinitions>(
    name: N
): ((type: Type) => type is StructInstanceType & KnownInstance<N>) => {
    const fn = (type: Type) => isStructInstance(type) && type.descriptor.name === name;
    return fn as never;
};

export const isImage = createAssertFn('Image');
export const isColor = createAssertFn('Color');
export const isDirectory = createAssertFn('Directory');
export const isTrue = createAssertFn('true');
export const isFalse = createAssertFn('false');

export const getFields = <N extends keyof KnownStructDefinitions>(
    type: StructInstanceType & KnownInstance<N>
): KnownStructDefinitions[N] => {
    const fields: Record<string, NonNeverType> = {};
    type.descriptor.fields.forEach((field, i) => {
        fields[field.name] = type.fields[i];
    });
    return fields as never;
};

export const nullType = getStructDescriptor(getChainnerScope(), 'null').default;
export const errorDescriptor = getStructDescriptor(getChainnerScope(), 'Error');
export const errorType = errorDescriptor.default;

export const withoutNull = (type: Type): Type => without(type, nullType);
export const withoutError = (type: Type): Type => without(type, errorType);

export const splitOutputTypeAndError = (type: Type): [Type, string | undefined] => {
    const error = intersect(type, errorType);
    if (error.type === 'never') {
        // no error
        return [type, undefined];
    }

    const pureType = without(type, errorType);

    // get the error message
    if (error.underlying !== 'struct' || error.type !== 'instance') {
        throw new Error('Error type is not a struct');
    }

    const messageType = error.getField('message')!;
    const messageItems = messageType.underlying === 'union' ? messageType.items : [messageType];
    const messages: string[] = [];
    for (const item of messageItems) {
        if (item.underlying === 'string' && item.type === 'literal') {
            messages.push(item.value);
        }
    }
    if (messages.length === 0) {
        messages.push('Unknown error');
    }

    return [pureType, messages.join(' ')];
};
