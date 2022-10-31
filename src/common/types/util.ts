import {
    IntIntervalType,
    NonNeverType,
    NumericLiteralType,
    StructType,
    Type,
    UnionType,
} from '@chainner/navi';

export type IntNumberType =
    | NumericLiteralType
    | IntIntervalType
    | UnionType<NumericLiteralType | IntIntervalType>;

export const isImage = (
    type: Type
): type is StructType & {
    readonly name: 'Image';
    readonly fields: readonly [
        { readonly name: 'width'; readonly type: IntNumberType },
        { readonly name: 'height'; readonly type: IntNumberType },
        { readonly name: 'channels'; readonly type: IntNumberType }
    ];
} => {
    return type.type === 'struct' && type.name === 'Image' && type.fields.length === 3;
};

export const getField = (struct: StructType, field: string): NonNeverType | undefined => {
    return struct.fields.find((f) => f.name === field)?.type;
};
