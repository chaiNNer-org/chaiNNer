/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */

import { assertValidStructFieldName, assertValidStructName } from './names';

export type Type = PrimitiveType | NeverType | AnyType | UnionType | StructType;
export type ValueType = PrimitiveType | StructType;
export type PrimitiveType = NumberPrimitive | StringPrimitive;
export type NumberPrimitive = NumberType | NumericLiteralType | IntervalType | IntIntervalType;
export type StringPrimitive = StringType | StringLiteralType;

/**
 * A de-duplicated and sorted array of types.
 */
export type CanonicalTypes<T extends Type> = readonly T[] & { readonly __CanonicalTypes: never };

export type WithUnderlying<U extends Type['underlying'], T extends Type = Type> = T extends {
    readonly underlying: U;
}
    ? T
    : never;
export type WithType<U extends Type['type'], T extends Type = Type> = T extends {
    readonly type: U;
}
    ? T
    : never;

export type NonTrivialType = ValueType | UnionType;
export type NonNeverType = ValueType | AnyType | UnionType;
export type StaticType = AnyType | NeverType | PrimitiveType | UnionType<PrimitiveType>;

const formatNumber = (n: number): string => {
    if (Number.isNaN(n)) return 'nan';
    if (n === Infinity) return 'inf';
    if (n === -Infinity) return '-inf';
    return String(n);
};
const formatInterval = (min: number, max: number) => {
    return `${formatNumber(min)}..${formatNumber(max)}`;
};

interface TypeBase {
    readonly type: Type['type'];
    readonly underlying: Type['underlying'];
    /**
     * Returns a unique string representation for the given type.
     *
     * It is guaranteed that any two types with the same type id are equivalent. Likewise, any two
     * equivalent types are guaranteed to have the same type id.
     */
    getTypeId(): string;
    toString(): string;
}

export class NumberType implements TypeBase {
    readonly type = 'number';

    readonly underlying = 'number';

    private constructor() {}

    getTypeId(): string {
        return 'number';
    }

    toString(): string {
        return this.getTypeId();
    }

    static readonly instance = new NumberType();
}
export class NumericLiteralType implements TypeBase {
    readonly type = 'literal';

    readonly underlying = 'number';

    readonly value: number;

    constructor(value: number) {
        this.value = value;
    }

    getTypeId(): string {
        return formatNumber(this.value);
    }

    toString(): string {
        return this.getTypeId();
    }
}
export class IntervalType implements TypeBase {
    readonly type = 'interval';

    readonly underlying = 'number';

    readonly min: number;

    readonly max: number;

    constructor(min: number, max: number) {
        if (Number.isNaN(min) || Number.isNaN(max)) {
            throw new Error(`min=${min} and max=${max} cannot be NaN`);
        }
        if (!(min < max)) {
            throw new Error(`min=${min} must be < max=${max}`);
        }

        this.min = min;
        this.max = max;
    }

    has(n: number): boolean {
        return this.min <= n && n <= this.max;
    }

    overlaps(other: IntervalType): boolean {
        return Math.max(this.min, other.min) <= Math.min(this.max, other.max);
    }

    getTypeId(): string {
        return formatInterval(this.min, this.max);
    }

    toString(): string {
        return this.getTypeId();
    }
}
export class IntIntervalType implements TypeBase {
    readonly type = 'int-interval';

    readonly underlying = 'number';

    readonly min: number;

    readonly max: number;

    constructor(min: number, max: number) {
        if (Number.isNaN(min) || Number.isNaN(max)) {
            throw new Error(`min=${min} and max=${max} cannot be NaN`);
        }
        if (
            !(Number.isInteger(min) || min === -Infinity) ||
            !(Number.isInteger(max) || max === Infinity)
        ) {
            throw new Error(`min=${min} and max=${max} must be integers or infinity`);
        }
        if (!(min < max)) {
            throw new Error(`min=${min} must be < max=${max}`);
        }

        this.min = min;
        this.max = max;
    }

    has(n: number): boolean {
        return Number.isInteger(n) && this.min <= n && n <= this.max;
    }

    getTypeId(): string {
        return `int(${formatInterval(this.min, this.max)})`;
    }

    toString(): string {
        return this.getTypeId();
    }
}

export class StringType implements TypeBase {
    readonly type = 'string';

    readonly underlying = 'string';

    private constructor() {}

    getTypeId(): string {
        return 'string';
    }

    toString(): string {
        return this.getTypeId();
    }

    static readonly instance = new StringType();
}
export class StringLiteralType implements TypeBase {
    readonly type = 'literal';

    readonly underlying = 'string';

    readonly value: string;

    constructor(value: string) {
        this.value = value;
    }

    getTypeId(): string {
        return JSON.stringify(this.value);
    }

    toString(): string {
        return this.getTypeId();
    }
}
// TODO: RegexType

export class AnyType implements TypeBase {
    readonly type = 'any';

    readonly underlying = 'any';

    private constructor() {}

    getTypeId(): string {
        return 'any';
    }

    toString(): string {
        return this.getTypeId();
    }

    static readonly instance = new AnyType();
}

export class UnionType<T extends ValueType = ValueType> implements TypeBase {
    readonly type = 'union';

    readonly underlying = 'union';

    readonly items: CanonicalTypes<T>;

    private cachedTypeId: string | undefined;

    constructor(items: CanonicalTypes<T>) {
        if (items.length < 2) throw new Error('A union has to have at least 2 items.');
        this.items = items;
    }

    getTypeId(): string {
        if (this.cachedTypeId === undefined) {
            this.cachedTypeId = this.items.map((item) => item.getTypeId()).join(' | ');
        }
        return this.cachedTypeId;
    }

    toString(): string {
        return this.getTypeId();
    }
}
export class NeverType implements TypeBase {
    readonly type = 'never';

    readonly underlying = 'never';

    private constructor() {}

    getTypeId(): string {
        return 'never';
    }

    toString(): string {
        return this.getTypeId();
    }

    static readonly instance = new NeverType();
}

export class StructTypeField {
    readonly name: string;

    readonly type: NonNeverType;

    constructor(name: string, type: NonNeverType) {
        assertValidStructFieldName(name);
        this.name = name;
        this.type = type;
    }
}
export class StructType implements TypeBase {
    readonly type = 'struct';

    readonly underlying = 'struct';

    readonly fields: readonly StructTypeField[];

    readonly name: string;

    private cachedTypeId: string | undefined;

    constructor(name: string, fields: readonly StructTypeField[] = []) {
        assertValidStructName(name);
        this.name = name;
        this.fields = fields;
    }

    getTypeId(): string {
        if (this.fields.length === 0) return this.name;
        if (this.cachedTypeId === undefined) {
            this.cachedTypeId = `${this.name} { ${this.fields
                .map((f) => `${f.name}: ${f.type.getTypeId()}`)
                .join(', ')} }`;
        }
        return this.cachedTypeId;
    }

    toString(): string {
        return this.getTypeId();
    }
}
