import {
    Arg,
    Int,
    Intrinsic,
    NeverType,
    NumberPrimitive,
    StringLiteralType,
    StringPrimitive,
    StringType,
    StructInstanceType,
    StructType,
    createInstance,
    getStructDescriptor,
    handleNumberLiterals,
    intersect,
    literal,
    wrapQuaternary,
    wrapScopedUnary,
    wrapTernary,
} from '@chainner/navi';
import path from 'path';
import { ColorJson } from '../common-types';
import { log } from '../log';
import { RRegex } from '../rust-regex';

type ReplacementToken =
    | { type: 'literal'; value: string }
    | { type: 'interpolation'; name: string };

class ReplacementString {
    readonly tokens: readonly ReplacementToken[];

    /**
     * The names of all replacements in this string.
     *
     * Example: `foo {4} bar {baz}` will have the names `4` and `baz`.
     */
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

    return Intrinsic.concat(...concatArgs);
};

const regexReplaceImpl = (
    text: string,
    regexPattern: string,
    replacementPattern: string,
    count: number
): string | undefined => {
    // parse and validate before doing actual work
    const regex = new RRegex(regexPattern);
    const replacement = new ReplacementString(replacementPattern);

    // check replacement keys
    const availableNames = new Set<string>([
        ...regex.captureNames(),
        ...Array.from({ length: regex.capturesLength() }, (_, i) => String(i)),
    ]);
    for (const name of replacement.names) {
        if (!availableNames.has(name)) {
            throw new Error(
                'Invalid replacement pattern.' +
                    ` "{${name}}" is not a valid replacement.` +
                    ` Available replacements: ${[...availableNames].join(', ')}.`
            );
        }
    }

    // do actual work
    if (count === 0) {
        return text;
    }
    const matches = regex.capturesAll(text).slice(0, Math.max(0, count || 0));
    if (matches.length === 0) {
        return text;
    }

    // rregex currently only supports byte offsets in matches. So we have to
    // match spans on UTF8 and then convert it back to Unicode.
    const utf8 = Buffer.from(text, 'utf8');
    const toUTF16 = (offset: number) => {
        return utf8.toString('utf8', 0, offset).length;
    };

    let result = '';
    let lastIndex = 0;
    for (const match of matches) {
        const full = match.get[0];
        result += text.slice(lastIndex, toUTF16(full.start));

        const replacements = new Map<string, string>();
        match.get.forEach((m, i) => replacements.set(String(i), m.value));
        Object.entries(match.name).forEach(([name, m]) => replacements.set(name, m.value));
        result += replacement.replace(replacements);

        lastIndex = toUTF16(full.end);
    }
    result += text.slice(lastIndex);

    return result;
};
export const regexReplace = wrapQuaternary<
    StringPrimitive,
    StringPrimitive,
    StringPrimitive,
    NumberPrimitive,
    StringPrimitive
>((text, regexPattern, replacementPattern, count) => {
    if (
        text.type === 'literal' &&
        regexPattern.type === 'literal' &&
        replacementPattern.type === 'literal' &&
        count.type === 'literal'
    ) {
        try {
            const result = regexReplaceImpl(
                text.value,
                regexPattern.value,
                replacementPattern.value,
                count.value
            );
            if (result !== undefined) {
                return new StringLiteralType(result);
            }
        } catch (error) {
            log.debug('regexReplaceImpl', error);
            return NeverType.instance;
        }
    }
    return StringType.instance;
});

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

export const padStart = wrapTernary<StringPrimitive, Int, StringPrimitive, StringPrimitive>(
    (text, width, padding) => {
        if (text.type !== 'literal') return StringType.instance;
        if (padding.type !== 'literal') return StringType.instance;
        try {
            return handleNumberLiterals<StringPrimitive>(width, StringType.instance, (i) =>
                literal(pyPadStart(text.value, i, padding.value))
            );
        } catch {
            return NeverType.instance;
        }
    }
);
export const padEnd = wrapTernary<StringPrimitive, Int, StringPrimitive, StringPrimitive>(
    (text, width, padding) => {
        if (text.type !== 'literal') return StringType.instance;
        if (padding.type !== 'literal') return StringType.instance;
        try {
            return handleNumberLiterals<StringPrimitive>(width, StringType.instance, (i) =>
                literal(pyPadEnd(text.value, i, padding.value))
            );
        } catch {
            return NeverType.instance;
        }
    }
);
export const padCenter = wrapTernary<StringPrimitive, Int, StringPrimitive, StringPrimitive>(
    (text, width, padding) => {
        if (text.type !== 'literal') return StringType.instance;
        if (padding.type !== 'literal') return StringType.instance;
        try {
            return handleNumberLiterals<StringPrimitive>(width, StringType.instance, (i) =>
                literal(pyPadCenter(text.value, i, padding.value))
            );
        } catch {
            return NeverType.instance;
        }
    }
);

export const splitFilePath = wrapScopedUnary(
    (scope, filePath: StringPrimitive): StructInstanceType => {
        const splitFilePathDesc = getStructDescriptor(scope, 'SplitFilePath');
        const directoryDesc = getStructDescriptor(scope, 'Directory');

        if (filePath.type === 'literal') {
            const base = path.basename(filePath.value);
            const ext = path.extname(base);
            const basename = ext ? base.slice(0, -ext.length) : base;

            return createInstance(splitFilePathDesc, {
                dir: createInstance(directoryDesc, {
                    path: literal(path.dirname(filePath.value)),
                }),
                basename: literal(basename),
                ext: literal(ext),
            });
        }
        return createInstance(splitFilePathDesc);
    }
);

export const parseColorJson = wrapScopedUnary(
    (scope, json: StringPrimitive): Arg<StructInstanceType> => {
        const colorDesc = getStructDescriptor(scope, 'Color');

        if (json.type === 'literal') {
            try {
                const value = JSON.parse(json.value) as unknown;
                if (value && typeof value === 'object' && 'kind' in value && 'values' in value) {
                    const color = value as ColorJson;
                    return createInstance(colorDesc, {
                        channels: literal(color.values.length),
                    });
                }
            } catch {
                // noop
            }
            return NeverType.instance;
        }
        return createInstance(colorDesc);
    }
);
