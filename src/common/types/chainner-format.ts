import { concat } from './builtin';
import { intersect } from './intersection';
import {
    NeverType,
    StringLiteralType,
    StringPrimitive,
    StringType,
    StructType,
    UnionType,
    ValueType,
} from './types';

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

    return concat(...concatArgs);
};
