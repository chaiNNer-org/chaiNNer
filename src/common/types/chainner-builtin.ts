import {
    Arg,
    Int,
    Intrinsic,
    NeverType,
    StringLiteralType,
    StringPrimitive,
    StringType,
    StructType,
    StructTypeField,
    handleNumberLiterals,
    intersect,
    literal,
    wrapTernary,
    wrapUnary,
} from '@chainner/navi';
import path from 'path';

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

export const splitFilePath = wrapUnary<StringPrimitive, StructType>((filePath: StringPrimitive) => {
    if (filePath.type === 'literal') {
        const base = path.basename(filePath.value);
        const ext = path.extname(base);
        const basename = ext ? base.slice(0, -ext.length) : base;
        return new StructType('SplitFilePath', [
            new StructTypeField(
                'dir',
                new StructType('Directory', [
                    new StructTypeField('path', literal(path.dirname(filePath.value))),
                ])
            ),
            new StructTypeField('basename', literal(basename)),
            new StructTypeField('ext', literal(ext)),
        ]);
    }
    return new StructType('SplitFilePath', [
        new StructTypeField(
            'dir',
            new StructType('Directory', [new StructTypeField('path', StringType.instance)])
        ),
        new StructTypeField('basename', StringType.instance),
        new StructTypeField('ext', StringType.instance),
    ]);
});
