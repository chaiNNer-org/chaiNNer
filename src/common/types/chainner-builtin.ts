import {
    Arg,
    Int,
    IntIntervalType,
    Intrinsic,
    NeverType,
    NumberPrimitive,
    StringLiteralType,
    StringPrimitive,
    StringType,
    StructType,
    StructTypeField,
    handleNumberLiterals,
    intersect,
    literal,
    wrapQuaternary,
    wrapTernary,
    wrapUnary,
} from '@chainner/navi';
import path from 'path';
import { ColorJson } from '../common-types';
import { log } from '../log';
import { RRegex } from '../rust-regex';
import { assertNever } from '../util';
import type { Group, Hir } from 'rregex';

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

/**
 * Iterates over all groups in the given hir in order.
 */
function* iterGroups(hir: Hir): Iterable<Group> {
    const { kind } = hir;
    if (kind['@variant'] === 'Group') {
        yield kind['@values'][0];
    }

    switch (kind['@variant']) {
        case 'Anchor':
        case 'Class':
        case 'Empty':
        case 'Literal':
        case 'WordBoundary': {
            break;
        }
        case 'Group':
        case 'Repetition': {
            yield* iterGroups(kind['@values'][0].hir);
            break;
        }
        case 'Alternation':
        case 'Concat': {
            for (const h of kind['@values'][0]) {
                yield* iterGroups(h);
            }
            break;
        }

        default:
            return assertNever(kind);
    }
}
interface CapturingGroupInfo {
    count: number;
    names: string[];
}
const getCapturingGroupInfo = (regex: RRegex): CapturingGroupInfo => {
    let count = 0;
    const names: string[] = [];

    for (const { kind } of iterGroups(regex.syntax())) {
        if (kind['@variant'] === 'NonCapturing') {
            // eslint-disable-next-line no-continue
            continue;
        }
        if (kind['@variant'] === 'CaptureName') {
            names.push(kind.name);
        }
        count += 1;
    }

    return { count, names };
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
    const captures = getCapturingGroupInfo(regex);
    const availableNames = new Set<string>([
        ...captures.names,
        '0',
        ...Array.from({ length: captures.count }, (_, i) => String(i + 1)),
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
    const matches = regex.findAll(text).slice(0, Math.max(0, count || 0));
    if (matches.length === 0) {
        return text;
    }

    // rregex doesn't support captures right now, so we can only support {0}
    // https://github.com/2fd/rregex/issues/32
    if (replacement.names.size > 0) {
        const [first] = replacement.names;
        if (replacement.names.size > 1 || first !== '0') {
            return undefined;
        }
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
        result += text.slice(lastIndex, toUTF16(match.start));

        const replacements = new Map<string, string>();
        replacements.set('0', match.value);
        result += replacement.replace(replacements);

        lastIndex = toUTF16(match.end);
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

export const parseColorJson = wrapUnary<StringPrimitive, StructType>((json) => {
    if (json.type === 'literal') {
        try {
            const value = JSON.parse(json.value) as unknown;
            if (value && typeof value === 'object' && 'kind' in value && 'values' in value) {
                const color = value as ColorJson;
                return new StructType('Color', [
                    new StructTypeField('channels', literal(color.values.length)),
                ]);
            }
        } catch {
            // noop
        }
        return NeverType.instance;
    }
    return new StructType('Color', [
        new StructTypeField('channels', new IntIntervalType(1, Infinity)),
    ]);
});
