import {
    NeverType,
    NumberPrimitive,
    StringLiteralType,
    StringPrimitive,
    StringType,
    StructType,
    UnionType,
    ValueType,
    builtin,
    intersect,
    literal,
    union,
} from '@chainner/navi';
import { EMPTY_ARRAY } from '../util';

type ReplacementToken =
    | { type: 'literal'; value: string }
    | { type: 'interpolation'; name: string };

class ReplacementString {
    readonly tokens: readonly ReplacementToken[];

    readonly names: ReadonlySet<string>;

    constructor(pattern: string) {
        const tokens: ReplacementToken[] = [];
        const names = new Set<string>();

        const contentPattern = /^\w+$/;

        const tokenPattern = /(\{\{)|\{([^{}]*)\}/g;
        let lastIndex = 0;
        let lastStr = '';
        let m;
        // eslint-disable-next-line no-cond-assign
        while ((m = tokenPattern.exec(pattern))) {
            lastStr += pattern.slice(lastIndex, m.index);
            lastIndex = m.index + m[0].length;

            const interpolation = m[2] as string | undefined;
            if (interpolation !== undefined) {
                if (interpolation === '') {
                    throw new Error(
                        'Invalid replacement pattern. {} is not a valid replacement.' +
                            ` Either specify a name or id number, or escape a single "{" as "{{".` +
                            ` Full pattern: ${pattern}`
                    );
                }
                if (!contentPattern.test(interpolation)) {
                    throw new Error(
                        'Invalid replacement pattern.' +
                            ` "{${interpolation}}" is not a valid replacement.` +
                            ' Names and ids only allow letters and digits.' +
                            ` Full pattern: ${pattern}`
                    );
                }

                tokens.push({ type: 'literal', value: lastStr });
                lastStr = '';
                tokens.push({ type: 'interpolation', name: interpolation });
                names.add(interpolation);
            } else {
                lastStr += '{';
            }
        }
        lastStr += pattern.slice(lastIndex);
        tokens.push({ type: 'literal', value: lastStr });

        this.tokens = tokens;
        this.names = names;
    }

    replace(replacements: ReadonlyMap<string, string>): string {
        let result = '';

        for (const token of this.tokens) {
            if (token.type === 'literal') {
                result += token.value;
            } else {
                const replacement = replacements.get(token.name);
                if (replacement !== undefined) {
                    result += replacement;
                } else {
                    throw new Error(
                        'Unknown replacement.' +
                            ` There is no replacement with the name or id ${token.name}.` +
                            ` Available replacements: ${[...replacements.keys()].join(', ')}.`
                    );
                }
            }
        }

        return result;
    }
}

type Arg<T extends ValueType> = T | UnionType<T> | NeverType;
export const formatTextPattern = (
    pattern: Arg<StringPrimitive>,
    ...args: Arg<StringPrimitive | StructType>[]
): Arg<StringPrimitive> => {
    if (pattern.type === 'never') return NeverType.instance;

    const argsMap = new Map<string, Arg<StringPrimitive>>();
    for (const [arg, name] of args.map((a, i) => [a, String(i + 1)] as const)) {
        if (arg.type === 'never') {
            return NeverType.instance;
        }
        const stringType = intersect(arg, StringType.instance);
        if (stringType.type !== 'never') {
            argsMap.set(name, stringType as Arg<StringPrimitive>);
        }
    }

    if (pattern.type !== 'literal') return StringType.instance;

    let parsed;
    try {
        parsed = new ReplacementString(pattern.value);
    } catch {
        // Invalid pattern
        return NeverType.instance;
    }

    const concatArgs: Arg<StringPrimitive>[] = [];
    for (const token of parsed.tokens) {
        if (token.type === 'literal') {
            concatArgs.push(new StringLiteralType(token.value));
        } else {
            const arg = argsMap.get(token.name);
            if (arg === undefined) {
                // invalid reference
                return NeverType.instance;
            }
            concatArgs.push(arg);
        }
    }

    return builtin.concat(...concatArgs);
};

const toValues = (arg: Arg<ValueType>): readonly ValueType[] => {
    if (arg.type === 'never') {
        return EMPTY_ARRAY;
    }
    if (arg.type === 'union') {
        return arg.items;
    }
    return [arg];
};

function wrap<
    A extends ValueType,
    B extends ValueType,
    C extends ValueType,
    R extends Arg<ValueType>
>(fn: (arg0: A, arg1: B, arg2: C) => R): (arg0: Arg<A>, arg1: Arg<B>, arg2: Arg<C>) => R;
function wrap<A extends ValueType, B extends ValueType, R extends Arg<ValueType>>(
    fn: (arg0: A, arg1: B) => R
): (arg0: Arg<A>, arg1: Arg<B>) => R;
function wrap<A extends ValueType, R extends Arg<ValueType>>(
    fn: (arg0: A) => R
): (arg0: Arg<A>) => R;
// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
function wrap(
    fn: (...args: ValueType[]) => Arg<ValueType>
): (...args: Arg<ValueType>[]) => Arg<ValueType> {
    return (...args): Arg<ValueType> => {
        // a few optimized versions for a small number of args
        if (args.length === 0) {
            return fn();
        }
        if (args.length === 1) {
            const [a] = args;
            if (a.type === 'never') return NeverType.instance;
            if (a.type === 'union') return union(...a.items.map((arg) => fn(arg)));
            return fn(a);
        }

        const values = args.map(toValues);

        // at least one arg is never
        if (values.some((v) => v.length === 0)) return NeverType.instance;

        if (values.length === 2) {
            // optimization for binary
            const [a, b] = values;
            const items: Arg<ValueType>[] = [];
            for (const aItem of a) {
                for (const bItem of b) {
                    items.push(fn(aItem, bItem));
                }
            }
            return union(...items);
        }

        const { length } = values;
        const indexes = Array.from({ length }, () => 0);
        const items: Arg<ValueType>[] = [];
        let done = false;
        while (!done) {
            const current: ValueType[] = [];
            for (let i = 0; i < length; i += 1) {
                current.push(values[i][indexes[i]]);
            }
            items.push(fn(...current));

            for (let i = length - 1; i >= 0; i -= 1) {
                // eslint-disable-next-line no-plusplus
                const next = ++indexes[i];
                if (next < values[i].length) {
                    break;
                }
                if (i === 0) {
                    done = true;
                    break;
                }
                indexes[i] = 0;
            }
        }
        return union(...items);
    };
}

const numberLiteral = <R extends ValueType>(
    value: NumberPrimitive,
    defaultValue: R,
    fn: (n: number) => Arg<R>
): Arg<R> => {
    if (value.type === 'literal') return fn(value.value);
    if (value.type === 'int-interval' && value.max - value.min <= 10) {
        const items: Arg<R>[] = [];
        for (let i = value.min; i <= value.max; i += 1) {
            items.push(fn(i));
        }
        return union(...items) as Arg<R>;
    }
    return defaultValue;
};

// Python-conform padding implementations.
// The challenge here is that JS string lengths count UTF-16 char codes,
// while python string lengths count Unicode code points.
const unicodeLength = (s: string) => [...s].length;
const pyPadStart = (text: string, width: number, char: string): string => {
    const charLength = unicodeLength(char);
    if (charLength !== 1) {
        throw new Error('Padding char has to be one character');
    }

    const textLength = unicodeLength(text);
    const missing = width - textLength;
    if (missing <= 0) return text;
    return char.repeat(missing) + text;
};
const pyPadEnd = (text: string, width: number, char: string): string => {
    const charLength = unicodeLength(char);
    if (charLength !== 1) {
        throw new Error('Padding char has to be one character');
    }

    const textLength = unicodeLength(text);
    const missing = width - textLength;
    if (missing <= 0) return text;
    return text + char.repeat(missing);
};
const pyPadCenter = (text: string, width: number, char: string): string => {
    const charLength = unicodeLength(char);
    if (charLength !== 1) {
        throw new Error('Padding char has to be one character');
    }

    const textLength = unicodeLength(text);
    const missing = width - textLength;
    if (missing <= 0) return text;
    const missingStart = Math.floor(missing / 2);
    return char.repeat(missingStart) + text + char.repeat(missing - missingStart);
};

export const padStart = wrap(
    (
        text: StringPrimitive,
        width: NumberPrimitive,
        padding: StringPrimitive
    ): Arg<StringPrimitive> => {
        if (text.type !== 'literal') return StringType.instance;
        if (padding.type !== 'literal') return StringType.instance;
        try {
            return numberLiteral<StringPrimitive>(width, StringType.instance, (i) =>
                literal(pyPadStart(text.value, i, padding.value))
            );
        } catch {
            return NeverType.instance;
        }
    }
);
export const padEnd = wrap(
    (
        text: StringPrimitive,
        width: NumberPrimitive,
        padding: StringPrimitive
    ): Arg<StringPrimitive> => {
        if (text.type !== 'literal') return StringType.instance;
        if (padding.type !== 'literal') return StringType.instance;
        try {
            return numberLiteral<StringPrimitive>(width, StringType.instance, (i) =>
                literal(pyPadEnd(text.value, i, padding.value))
            );
        } catch {
            return NeverType.instance;
        }
    }
);
export const padCenter = wrap(
    (
        text: StringPrimitive,
        width: NumberPrimitive,
        padding: StringPrimitive
    ): Arg<StringPrimitive> => {
        if (text.type !== 'literal') return StringType.instance;
        if (padding.type !== 'literal') return StringType.instance;
        try {
            return numberLiteral<StringPrimitive>(width, StringType.instance, (i) =>
                literal(pyPadCenter(text.value, i, padding.value))
            );
        } catch {
            return NeverType.instance;
        }
    }
);
