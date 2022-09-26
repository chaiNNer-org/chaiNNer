import {
    IntIntervalType,
    IntervalType,
    NeverType,
    NumberPrimitive,
    NumberType,
    NumericLiteralType,
    StringLiteralType,
    StringPrimitive,
    StringType,
    StructType,
    UnionType,
    ValueType,
} from './types';
import { union } from './union';
import { intInterval, interval, literal } from './util';

const fixRoundingError = (n: number): number => {
    if (!Number.isFinite(n)) return n;

    const expS = n.toExponential(15);
    if (/0{6}[0-3]\d[eE][+-]\d+$/.test(expS)) {
        return Number(n.toExponential(12));
    }

    if (Number.isInteger(n)) return n;
    const s = String(n);
    if (/(?:9{6}[6-9]|0{6}[0-3])\d$/.test(s)) {
        return Number(n.toPrecision(12));
    }
    return n;
};

type Arg<T extends ValueType> = T | UnionType<T> | NeverType;

export type UnaryFn<T extends ValueType, R extends ValueType = T> = (a: Arg<T>) => Arg<R>;
export type BinaryFn<T extends ValueType, R extends ValueType = T> = (
    a: Arg<T>,
    b: Arg<T>
) => Arg<R>;
export type VarArgsFn<T extends ValueType> = (...args: Arg<T>[]) => Arg<T>;

function wrapUnary(fn: (a: StringPrimitive) => Arg<StringPrimitive>): UnaryFn<StringPrimitive>;
function wrapUnary(fn: (a: NumberPrimitive) => Arg<NumberPrimitive>): UnaryFn<NumberPrimitive>;
function wrapUnary<T extends ValueType, R extends ValueType = T>(
    fn: (a: T) => Arg<R>
): UnaryFn<T, R>;
// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
function wrapUnary<T extends ValueType, R extends ValueType = T>(
    fn: (a: T) => Arg<R>
): UnaryFn<T, R> {
    return (a) => {
        if (a.type === 'never') return NeverType.instance;
        if (a.type === 'union') return union(...a.items.map(fn)) as Arg<R>;
        return fn(a);
    };
}
const wrapBinary = <T extends ValueType, R extends ValueType = T>(
    fn: (a: T, b: T) => Arg<R>
): BinaryFn<T, R> => {
    return (a, b) => {
        if (a.type === 'never' || b.type === 'never') return NeverType.instance;
        if (a.type === 'union') {
            if (b.type !== 'union') {
                return union(...a.items.map((aItem) => fn(aItem, b))) as Arg<R>;
            }

            const items: Arg<R>[] = [];
            for (const aItem of a.items) {
                for (const bItem of b.items) {
                    items.push(fn(aItem, bItem));
                }
            }
            return union(...items) as Arg<R>;
        }
        if (b.type === 'union') {
            return union(...b.items.map((bItem) => fn(a, bItem))) as Arg<R>;
        }
        return fn(a, b);
    };
};

function wrapVarArgs(
    neutral: Arg<StringPrimitive>,
    fn: (a: StringPrimitive, b: StringPrimitive) => Arg<StringPrimitive>
): VarArgsFn<StringPrimitive>;
function wrapVarArgs(
    neutral: Arg<NumberPrimitive>,
    fn: (a: NumberPrimitive, b: NumberPrimitive) => Arg<NumberPrimitive>
): VarArgsFn<NumberPrimitive>;
// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
function wrapVarArgs<T extends ValueType>(
    neutral: Arg<T>,
    fn: (a: T, b: T) => Arg<T>
): VarArgsFn<T> {
    const binary = wrapBinary(fn);
    return (...args) => {
        if (args.length === 0) return neutral;
        let result = args[0];
        for (let i = 1; i < args.length; i += 1) {
            result = binary(result, args[i]);
        }
        return result;
    };
}

const isSmallIntInterval = (type: IntIntervalType): boolean => {
    return type.max - type.min <= 10;
};
const mapSmallIntInterval = (
    { min, max }: IntIntervalType,
    mapFn: (i: number) => Arg<NumberPrimitive>
): Arg<NumberPrimitive> => {
    const items: Arg<NumberPrimitive>[] = [];
    for (let i = min; i <= max; i += 1) {
        items.push(mapFn(i));
    }
    return union(...items);
};

const addLiteral = (a: NumericLiteralType, b: NumberPrimitive): Arg<NumberPrimitive> => {
    if (Number.isNaN(a.value)) return a;

    if (b.type === 'literal') return literal(fixRoundingError(a.value + b.value));

    if (a.value === Infinity) {
        if (b.type === 'number' || b.min === -Infinity) {
            return union(literal(NaN), literal(Infinity));
        }
        return a;
    }
    if (a.value === -Infinity) {
        if (b.type === 'number' || b.max === -Infinity) {
            return union(literal(NaN), literal(-Infinity));
        }
        return a;
    }

    if (b.type === 'number') return NumberType.instance;

    const min = fixRoundingError(a.value + b.min);
    const max = fixRoundingError(a.value + b.max);
    if (min === max) return literal(min);

    if (b.type === 'int-interval') {
        if (Number.isInteger(a.value)) return new IntIntervalType(min, max);

        if (isSmallIntInterval(b)) {
            return mapSmallIntInterval(b, (i) => literal(fixRoundingError(i + a.value)));
        }
    }

    return new IntervalType(min, max);
};
export const add = wrapVarArgs(literal(0), (a: NumberPrimitive, b: NumberPrimitive) => {
    if (a.type === 'literal') return addLiteral(a, b);
    if (b.type === 'literal') return addLiteral(b, a);

    if (a.type === 'number' || b.type === 'number') return NumberType.instance;

    const min = fixRoundingError(a.min + b.min);
    const max = fixRoundingError(a.max + b.max);
    if (min === max) return literal(min);

    if (a.type === 'int-interval' && b.type === 'int-interval')
        return new IntIntervalType(min, max);
    return new IntervalType(min, max);
});
export const negate = wrapUnary((n: NumberPrimitive) => {
    if (n.type === 'number') return NumberType.instance;
    if (n.type === 'interval') return new IntervalType(-n.max, -n.min);
    if (n.type === 'int-interval') return new IntIntervalType(-n.max, -n.min);
    return literal(-n.value);
});
export const subtract: BinaryFn<NumberPrimitive> = (a, b) => add(a, negate(b));

const multiplyLiteral = (a: NumericLiteralType, b: NumberPrimitive): Arg<NumberPrimitive> => {
    if (Number.isNaN(a.value)) return a;
    if (a.value === 1) return b;
    if (a.value === -1) return negate(b);

    if (b.type === 'literal') return literal(fixRoundingError(a.value * b.value));

    if (a.value === Infinity) {
        if (b.type === 'number') {
            return union(literal(NaN), literal(-Infinity), literal(Infinity));
        }

        const items: NumberPrimitive[] = [];
        if (b.has(0)) items.push(literal(NaN));
        if (b.min < 0) items.push(literal(-Infinity));
        if (b.max > 0) items.push(literal(Infinity));

        if (items.length === 1) return items[0];
        return union(...items);
    }
    if (a.value === -Infinity) {
        if (b.type === 'number') {
            return union(literal(NaN), literal(-Infinity), literal(Infinity));
        }

        const items: NumberPrimitive[] = [];
        if (b.has(0)) items.push(literal(NaN));
        if (b.min < 0) items.push(literal(Infinity));
        if (b.max > 0) items.push(literal(-Infinity));

        if (items.length === 1) return items[0];
        return union(...items);
    }
    if (a.value === 0) {
        if (b.type === 'int-interval') return literal(0);
        if (b.type === 'number' || b.min === -Infinity || b.max === Infinity) {
            return union(literal(NaN), literal(0));
        }
        return literal(0);
    }

    if (b.type === 'number') return NumberType.instance;

    const min = fixRoundingError(b.min * a.value);
    const max = fixRoundingError(b.max * a.value);

    if (b.type === 'int-interval') {
        // This is a problem. Multiplying int intervals with a constant is not easy.
        // We cannot correctly represent int(0..Infinity) * 4. So we will multiply the elements of
        // small int interval individually, and approximate larger intervals.
        if (isSmallIntInterval(b)) {
            return mapSmallIntInterval(b, (i) => literal(fixRoundingError(i * a.value)));
        }

        if (Number.isInteger(a.value)) {
            if (a.value < 0) return intInterval(max, min);
            return intInterval(min, max);
        }
    }

    if (a.value < 0) return interval(max, min);
    return interval(min, max);
};
export const multiply = wrapVarArgs(literal(1), (a: NumberPrimitive, b: NumberPrimitive) => {
    if (a.type === 'literal') return multiplyLiteral(a, b);
    if (b.type === 'literal') return multiplyLiteral(b, a);

    if (a.type === 'number' || b.type === 'number') return NumberType.instance;

    const points = [a.min * b.min, a.min * b.max, a.max * b.min, a.max * b.max]
        .map(fixRoundingError)
        .filter((x) => !Number.isNaN(x));
    const min = Math.min(...points);
    const max = Math.max(...points);
    const i =
        a.type === 'interval' || b.type === 'interval' ? interval(min, max) : intInterval(min, max);

    const hasNaN =
        (a.has(0) && (b.has(Infinity) || b.has(-Infinity))) ||
        (b.has(0) && (a.has(Infinity) || a.has(-Infinity)));
    if (hasNaN) {
        return union(literal(NaN), i);
    }
    return i;
});
const reciprocalLiteral = (value: number): Arg<NumberPrimitive> => {
    if (value === 0) return union(literal(-Infinity), literal(Infinity));
    return literal(1 / value);
};
export const reciprocal = wrapUnary((n: NumberPrimitive) => {
    // In this function, 1/0 is -Infinity | Infinity
    if (n.type === 'number') return NumberType.instance;
    if (n.type === 'literal') return reciprocalLiteral(n.value);
    if (n.type === 'int-interval') {
        // Same as with multiply. We cannot accurately represent 1 over and int interval, so we
        // will approximate and destructure small int intervals.
        if (isSmallIntInterval(n)) {
            return mapSmallIntInterval(n, reciprocalLiteral);
        }

        if (n.has(0)) {
            const items: NumberPrimitive[] = [literal(-Infinity), literal(Infinity)];

            if (n.min === -Infinity && n.max === Infinity) {
                items.push(interval(-1, 1));
            } else {
                if (n.max !== 0) items.push(interval(1 / n.max, 1));
                if (n.min !== 0) items.push(interval(-1, 1 / n.min));
            }

            return union(...items);
        }
        return interval(1 / n.max, 1 / n.min);
    }

    if (n.min === -Infinity && n.max === Infinity) return n;
    if (n.has(0)) {
        const items: NumberPrimitive[] = [literal(-Infinity), literal(Infinity)];

        items.push(n.max === 0 ? literal(Infinity) : interval(1 / n.max, Infinity));
        items.push(n.min === 0 ? literal(-Infinity) : interval(-Infinity, 1 / n.min));
        return union(...items);
    }
    return interval(1 / n.max, 1 / n.min);
});
export const divide: BinaryFn<NumberPrimitive> = (a, b) => multiply(a, reciprocal(b));

export const round = wrapUnary((n: NumberPrimitive) => {
    if (n.type === 'literal') return literal(Math.round(n.value));
    if (n.type === 'int-interval') return n;
    if (n.type === 'number')
        return union(
            literal(NaN),
            literal(-Infinity),
            literal(Infinity),
            new IntIntervalType(-Infinity, Infinity)
        );

    const min = Math.round(n.min);
    const max = Math.round(n.max);
    if (min === max) return literal(min);
    if (Number.isFinite(min) && Number.isFinite(max)) return new IntIntervalType(min, max);

    const items: NumberPrimitive[] = [new IntIntervalType(min, max)];
    if (min === -Infinity) items.push(literal(-Infinity));
    if (max === Infinity) items.push(literal(Infinity));
    return union(...items);
});
export const floor = wrapUnary((n: NumberPrimitive) => {
    if (n.type === 'literal') return literal(Math.floor(n.value));
    if (n.type === 'int-interval') return n;
    if (n.type === 'number')
        return union(
            literal(NaN),
            literal(-Infinity),
            literal(Infinity),
            new IntIntervalType(-Infinity, Infinity)
        );

    const min = Math.floor(n.min);
    const max = Math.floor(n.max);
    if (min === max) return literal(min);
    if (Number.isFinite(min) && Number.isFinite(max)) return new IntIntervalType(min, max);

    const items: NumberPrimitive[] = [new IntIntervalType(min, max)];
    if (min === -Infinity) items.push(literal(-Infinity));
    if (max === Infinity) items.push(literal(Infinity));
    return union(...items);
});
export const ceil: UnaryFn<NumberPrimitive> = (a) => negate(floor(negate(a)));
export const degToRad: UnaryFn<NumberPrimitive> = (a) => multiply(a, literal(Math.PI / 180));

const moduleLiteral = (a: NumberPrimitive, b: number): Arg<NumberPrimitive> => {
    if (b === 0) {
        // any % 0 will always throw a ZeroDivisionError
        return NeverType.instance;
    }

    return subtract(a, multiply(literal(b), floor(divide(a, literal(b)))));
};
export const modulo = wrapBinary<NumberPrimitive>((a, b) => {
    if (b.type === 'literal') return moduleLiteral(a, b.value);
    if (b.type === 'int-interval' && isSmallIntInterval(b)) {
        return mapSmallIntInterval(b, (i) => moduleLiteral(a, i));
    }

    return subtract(a, multiply(b, floor(divide(a, b))));
});

const minimumLiteral = (a: NumericLiteralType, b: NumberPrimitive): Arg<NumberPrimitive> => {
    if (Number.isNaN(a.value)) return a;
    if (a.value === Infinity) return b;

    if (b.type === 'literal') return literal(Math.min(a.value, b.value));
    if (b.type === 'number') return union(literal(NaN), interval(-Infinity, a.value));

    if (a.value <= b.min) return a;
    if (b.max <= a.value) return b;

    if (b.type === 'int-interval') {
        const aInt = Math.floor(a.value);
        if (aInt === a.value) return new IntIntervalType(b.min, aInt);
        if (aInt === b.min) return union(literal(b.min), literal(a.value));
        return union(new IntIntervalType(b.min, aInt), literal(a.value));
    }

    return interval(b.min, a.value);
};
const minimumNumber = (
    a: NumberType,
    b: NumberType | IntervalType | IntIntervalType
): Arg<NumberPrimitive> => {
    if (b.type === 'number') return NumberType.instance;
    if (b.max === Infinity) return NumberType.instance;
    return union(literal(NaN), interval(-Infinity, b.max));
};
const minimumIntInterval = (
    a: IntIntervalType,
    b: IntervalType | IntIntervalType
): Arg<NumberPrimitive> => {
    if (a.max <= b.min) return a;
    if (b.max <= a.min) return b;

    if (b.type === 'int-interval')
        return new IntIntervalType(Math.min(a.min, b.min), Math.min(a.max, b.max));

    if (b.min <= a.min) return new IntervalType(b.min, Math.min(a.max, b.max));

    // This part is kind of difficult. The integer interval part is smaller than the real interval
    // part. This means that the result will be a union.
    // E.g. minimum(int(0..100), 5.5..8.5) => int(0..5) | 5.5..8.5

    const intMax = Number.isInteger(b.min) ? b.min - 1 : Math.floor(b.min);
    return union(intInterval(a.min, intMax), interval(b.min, Math.min(a.max, b.max)));
};
export const minimum = wrapVarArgs(literal(Infinity), (a: NumberPrimitive, b: NumberPrimitive) => {
    if (a.type === 'literal') return minimumLiteral(a, b);
    if (b.type === 'literal') return minimumLiteral(b, a);

    if (a.type === 'number') return minimumNumber(a, b);
    if (b.type === 'number') return minimumNumber(b, a);

    if (a.type === 'int-interval') return minimumIntInterval(a, b);
    if (b.type === 'int-interval') return minimumIntInterval(b, a);

    return new IntervalType(Math.min(a.min, b.min), Math.min(a.max, b.max));
});
export const maximum = wrapVarArgs(literal(-Infinity), (a: NumberPrimitive, b: NumberPrimitive) => {
    return negate(minimum(negate(a), negate(b)));
});

export const abs = wrapUnary<NumberPrimitive>((a) => {
    if (a.type === 'literal') return literal(Math.abs(a.value));
    if (a.type === 'number') return union(literal(NaN), interval(0, Infinity));

    let min;
    let max;
    if (a.min > 0) {
        min = a.min;
        max = a.max;
    } else if (a.max < 0) {
        min = -a.max;
        max = -a.min;
    } else {
        min = 0;
        max = Math.max(Math.abs(a.min), Math.abs(a.max));
    }

    if (a.type === 'int-interval') return intInterval(min, max);
    return interval(min, max);
});

export const sin = wrapUnary<NumberPrimitive>((a: NumberPrimitive) => {
    if (a.type === 'literal') return literal(Math.sin(a.value));
    if (a.type === 'number') return union(literal(NaN), interval(-1, 1));

    if (a.type === 'int-interval' && isSmallIntInterval(a)) {
        return mapSmallIntInterval(a, (i) => literal(Math.sin(i)));
    }

    // the following could be improved, but it's not important right now
    if (a.has(-Infinity) || a.has(Infinity)) {
        return union(literal(NaN), interval(-1, 1));
    }
    return interval(-1, 1);
});
export const cos = wrapUnary<NumberPrimitive>((a: NumberPrimitive) => {
    if (a.type === 'literal') return literal(Math.cos(a.value));
    if (a.type === 'number') return union(literal(NaN), interval(-1, 1));

    if (a.type === 'int-interval' && isSmallIntInterval(a)) {
        return mapSmallIntInterval(a, (i) => literal(Math.cos(i)));
    }

    // the following could be improved, but it's not important right now
    if (a.has(-Infinity) || a.has(Infinity)) {
        return union(literal(NaN), interval(-1, 1));
    }
    return interval(-1, 1);
});

export const exp = wrapUnary<NumberPrimitive>((a) => {
    if (a.type === 'number') return union(literal(NaN), interval(0, Infinity));
    if (a.type === 'literal') return literal(fixRoundingError(Math.exp(a.value)));

    if (a.type === 'int-interval' && isSmallIntInterval(a)) {
        return mapSmallIntInterval(a, (i) => literal(fixRoundingError(Math.exp(i))));
    }

    return interval(fixRoundingError(Math.exp(a.min)), fixRoundingError(Math.exp(a.max)));
});
const logLiteral = (value: number): Arg<NumberPrimitive> => {
    if (value <= 0) return NeverType.instance;
    return literal(fixRoundingError(Math.log(value)));
};
/**
 * This models the behavior of Python's `math.log` function.
 *
 * This function throws on error for values <= 0.
 */
export const log = wrapUnary<NumberPrimitive>((a) => {
    if (a.type === 'number') return NumberType.instance;
    if (a.type === 'literal') return logLiteral(a.value);

    if (a.max <= 0) return NeverType.instance;

    if (a.type === 'int-interval' && isSmallIntInterval(a)) {
        return mapSmallIntInterval(a, logLiteral);
    }

    return interval(
        fixRoundingError(Math.log(Math.max(0, a.min))),
        fixRoundingError(Math.log(a.max))
    );
});

const powPositiveLiteral = (a: number, b: NumberPrimitive): Arg<NumberPrimitive> => {
    if (a === 1) return literal(1);
    return exp(multiplyLiteral(literal(Math.log(a)), b));
};
const powLiteral = (a: number, b: NumberPrimitive): Arg<NumberPrimitive> => {
    if (Number.isNaN(a)) {
        return literal(NaN);
    }
    if (Number.isFinite(a)) {
        if (a > 0) {
            return powPositiveLiteral(a, b);
        }
        if (a < 0) {
            return negate(powPositiveLiteral(-a, b));
        }
    }
    return NumberType.instance;
};
/**
 * Implements a power operation with the same behavior as Python's `**` operator.
 *
 * Note that the behavior of Python's `math.pow` and `**` are slightly different from each other and JS's `Math.pow`.
 * See https://github.com/joeyballentine/chaiNNer/issues/837 for more details.
 */
export const pow = wrapBinary<NumberPrimitive>((a, b) => {
    // Python's ** behavior is super strange and inconsistent because the operations is implemented by the operants
    // via operator overloading. So this will only implement the part that all implementations should agree on and
    // none of the edge cases.

    if (a.type === 'literal') return powLiteral(a.value, b);
    if (a.type === 'int-interval' && isSmallIntInterval(a)) {
        return mapSmallIntInterval(a, (i) => powLiteral(i, b));
    }

    return NumberType.instance;
});

export const toString = wrapUnary<StringPrimitive | NumberPrimitive, StringPrimitive>((a) => {
    if (a.underlying === 'string') return a;
    if (a.type === 'literal') {
        // Keep in mind, the actual string conversion is done by python and that might implement
        // it differently than JS. As such, we can only convert numbers where we are sure that the
        // result will be the same of python's.
        if (Number.isInteger(a.value) && Math.abs(a.value) <= Number.MAX_SAFE_INTEGER) {
            return new StringLiteralType(String(a.value));
        }
    }
    // we cannot statically determine the output string
    return StringType.instance;
});

export const concat = wrapVarArgs(new StringLiteralType(''), (a, b) => {
    if (a.type === 'literal' && b.type === 'literal') {
        return new StringLiteralType(a.value + b.value);
    }
    return StringType.instance;
});

const boolTrue = new StructType('true');
const boolFalse = new StructType('false');
const bool = union(boolFalse, boolTrue);

type NonNan = NumericLiteralType | IntervalType | IntIntervalType;
const handleNan = (
    n: NumberPrimitive
): { has: false; without: NonNan } | { has: true; without: NonNan | undefined } => {
    if (n.type === 'int-interval' || n.type === 'interval') {
        return { has: false, without: n };
    }
    if (n.type === 'number') {
        return { has: true, without: new IntervalType(-Infinity, Infinity) };
    }

    if (Number.isNaN(n.value)) {
        return { has: true, without: undefined };
    }
    return { has: false, without: n };
};

class CompareInterval {
    readonly min: number;

    readonly max: number;

    readonly minExclusive: boolean;

    readonly maxExclusive: boolean;

    constructor(min: number, max: number, minExclusive: boolean, maxExclusive: boolean) {
        this.min = min;
        this.max = max;
        this.minExclusive = minExclusive;
        this.maxExclusive = maxExclusive;
    }

    static from(n: NonNan): CompareInterval {
        if (n.type === 'literal') {
            return new CompareInterval(n.value, n.value, false, false);
        }
        if (n.type === 'interval') {
            return new CompareInterval(n.min, n.max, false, false);
        }

        const minExclusive = !Number.isFinite(n.min);
        const maxExclusive = !Number.isFinite(n.max);
        return new CompareInterval(n.min, n.max, minExclusive, maxExclusive);
    }

    has(n: number): boolean {
        if (n === this.min && !this.minExclusive) return true;
        if (n === this.max && !this.maxExclusive) return true;
        return this.min < n && n < this.max;
    }

    someLess(right: CompareInterval): boolean {
        return this.min < right.max;
    }

    someLessEqual(right: CompareInterval): boolean {
        return (
            this.min < right.max ||
            (this.min === right.max && !this.minExclusive && !right.maxExclusive)
        );
    }

    someGreater(right: CompareInterval): boolean {
        return right.someLess(this);
    }

    someGreaterEqual(right: CompareInterval): boolean {
        return right.someLessEqual(this);
    }
}

const lessThenReal = (a: NonNan, b: NonNan): Arg<StructType> => {
    const l = CompareInterval.from(a);
    const r = CompareInterval.from(b);

    if (l.someLess(r)) {
        if (l.someGreaterEqual(r)) {
            return bool;
        }
        return boolTrue;
    }
    return boolFalse;
};
export const lessThan = wrapBinary<NumberPrimitive, StructType>((a, b) => {
    const aNan = handleNan(a);
    const bNan = handleNan(b);

    if (aNan.has || bNan.has) {
        if (aNan.without && bNan.without) {
            return union(boolFalse, lessThenReal(aNan.without, bNan.without));
        }
        return boolFalse;
    }
    return lessThenReal(aNan.without, bNan.without);
});
const lessThenEqualReal = (a: NonNan, b: NonNan): Arg<StructType> => {
    const l = CompareInterval.from(a);
    const r = CompareInterval.from(b);

    if (l.someLessEqual(r)) {
        if (l.someGreater(r)) {
            return bool;
        }
        return boolTrue;
    }
    return boolFalse;
};
export const lessThanEqual = wrapBinary<NumberPrimitive, StructType>((a, b) => {
    const aNan = handleNan(a);
    const bNan = handleNan(b);

    if (aNan.has || bNan.has) {
        if (aNan.without && bNan.without) {
            return union(boolFalse, lessThenEqualReal(aNan.without, bNan.without));
        }
        return boolFalse;
    }
    return lessThenEqualReal(aNan.without, bNan.without);
});
