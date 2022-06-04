const namePattern = /^(?!(?:NaN|Infinity)$)[a-zA-Z_]\w*$/;

export const assertValidStructName = (name: string): void => {
    if (!namePattern.test(name))
        throw new Error(
            `Invalid name. Struct name ${JSON.stringify(name)} must match ${String(namePattern)}`
        );
};

export const assertValidStructFieldName = (name: string): void => {
    if (!namePattern.test(name))
        throw new Error(
            `Invalid name. Struct field name ${JSON.stringify(name)} must match ${String(
                namePattern
            )}`
        );
};
