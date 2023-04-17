import {
    Expression,
    IntIntervalType,
    NonNeverType,
    NumericLiteralType,
    StringPrimitive,
    StructExpression,
    StructExpressionField,
    StructType,
    Type,
    UnionType,
    without,
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

export const isColor = (
    type: Type
): type is StructType & {
    readonly name: 'Color';
    readonly fields: readonly [{ readonly name: 'channels'; readonly type: IntNumberType }];
} => {
    return type.type === 'struct' && type.name === 'Color' && type.fields.length === 1;
};

export const isDirectory = (
    type: Type
): type is StructType & {
    readonly name: 'Directory';
    readonly fields: readonly [{ readonly name: 'path'; readonly type: StringPrimitive }];
} => {
    return type.type === 'struct' && type.name === 'Directory' && type.fields.length === 1;
};

export const getField = (struct: StructType, field: string): NonNeverType | undefined => {
    return struct.fields.find((f) => f.name === field)?.type;
};

const nullType = new StructType('null');

export const withoutNull = (type: Type): Type => without(type, nullType);

export const struct = (name: string, fields: Record<string, Expression>): StructExpression => {
    return new StructExpression(
        name,
        Object.entries(fields).map(([n, e]) => new StructExpressionField(n, e))
    );
};
