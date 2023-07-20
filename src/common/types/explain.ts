import {
    IntIntervalType,
    NumberPrimitive,
    NumericLiteralType,
    StringPrimitive,
    StructType,
    Type,
    UnionType,
    ValueType,
} from '@chainner/navi';
import { joinEnglish } from '../util';
import { IntNumberType, isColor, isDirectory, isImage } from './util';

const isInt = (n: Type, min = -Infinity, max = Infinity): n is IntIntervalType => {
    return n.underlying === 'number' && n.type === 'int-interval' && n.min === min && n.max === max;
};

const getAcceptedNumbers = (number: IntNumberType): Set<number> | undefined => {
    const numbers = new Set<number>();
    let infinite = false;

    const add = (n: NumericLiteralType | IntIntervalType): void => {
        if (n.type === 'literal') {
            numbers.add(n.value);
        } else if (n.max - n.min < 10) {
            for (let i = n.min; i <= n.max; i += 1) {
                numbers.add(i);
            }
        } else {
            infinite = true;
        }
    };

    if (number.type === 'union') {
        number.items.forEach(add);
    } else {
        add(number);
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return infinite ? undefined : numbers;
};
export const formatChannelNumber = (n: IntNumberType, subject: string): string | undefined => {
    const numbers = getAcceptedNumbers(n);
    if (!numbers) return undefined;

    const known: string[] = [];
    if (numbers.has(1)) known.push('grayscale');
    if (numbers.has(3)) known.push('RGB');
    if (numbers.has(4)) known.push('RGBA');

    if (known.length === numbers.size) {
        const article = known[0] === 'grayscale' ? 'a' : 'an';
        if (known.length === 1) return `${article} ${known[0]} ${subject}`;
        if (known.length === 2) return `${article} ${known[0]} or ${known[1]} ${subject}`;
        if (known.length === 3)
            return `${article} ${known[0]}, ${known[1]} or ${known[2]} ${subject}`;
    }

    return undefined;
};

const explainNumber = (n: NumberPrimitive): string | undefined => {
    if (n.type === 'number') return 'a number';
    if (n.type === 'literal') return `the number ${n.value}`;

    const kind = n.type === 'int-interval' ? 'an integer' : 'a number';
    if (n.min === -Infinity && n.max === Infinity) return kind;
    if (n.min === -Infinity) return `${kind} that is at most ${n.max}`;
    if (n.max === Infinity) return `${kind} that is at least ${n.min}`;
    return `${kind} between ${n.min} and ${n.max}`;
};

const explainString = (s: StringPrimitive): string | undefined => {
    if (s.type === 'string') return 'a string';
    if (s.type === 'literal') return `the string ${JSON.stringify(s.value)}`;
    if (s.excluded.size === 1 && s.excluded.has('')) return 'a non-empty string';
};

const explainStruct = (s: StructType, options: ExplainOptions): string | undefined => {
    const detailed = (base: string | undefined, detail: string): string | undefined => {
        if (options.detailed && base) return `${base} ${detail}`;
        return base;
    };

    if (isImage(s)) {
        const width = s.fields[0].type;
        const height = s.fields[1].type;
        const channels = s.fields[2].type;

        if (isInt(width, 0) && isInt(height, 0)) {
            if (isInt(channels, 1)) return detailed('an image', 'of any size and any colorspace');
            return detailed(formatChannelNumber(channels, 'image'), 'of any size');
        }
        if (isInt(width, 1) && isInt(height, 1)) {
            if (isInt(channels, 1)) return detailed('an non-empty image', 'of any colorspace');
            const formatted = formatChannelNumber(channels, 'image');
            if (formatted) return `${formatted} that isn't empty`;
        }
    }

    if (isColor(s)) {
        const channels = s.fields[0].type;

        if (isInt(channels, 1)) return detailed('a color', 'of any colorspace');
        return formatChannelNumber(channels, 'color');
    }

    if (isDirectory(s)) {
        const path = s.fields[0].type;
        if (path.type === 'string') return 'a directory path';
    }

    if (s.name === 'Seed') {
        return 'a seed (for randomness)';
    }
};

const explainValue = (type: ValueType, options: ExplainOptions): string | undefined => {
    if (type.underlying === 'number') return explainNumber(type);
    if (type.underlying === 'string') return explainString(type);
    return explainStruct(type, options);
};

const explainUnion = (u: UnionType, options: ExplainOptions): string | undefined => {
    let hasUnknown = false;
    const known: string[] = [];
    for (const item of u.items) {
        const explanation = explainValue(item, options);
        if (explanation) {
            known.push(explanation);
        } else {
            if (options.strictUnion) return undefined;
            hasUnknown = true;
        }
    }

    if (known.length === 0) return undefined;
    if (hasUnknown) {
        known.push('some other value');
    }

    return joinEnglish(known, 'or');
};

export interface ExplainOptions {
    /**
     * If `true`, unions will only be explained if all of their items can be explained.
     *
     * @default false
     */
    readonly strictUnion?: boolean;
    /**
     * If `true`, types will be explained in more detail. E.g. with examples.
     *
     * @default false
     */
    readonly detailed?: boolean;
}

/**
 * Tries to explain the type in plain English.
 */
export const explain = (type: Type, options: ExplainOptions): string | undefined => {
    if (type.underlying === 'any') return 'any value';
    if (type.underlying === 'never') return 'no value';
    if (type.underlying === 'union') return explainUnion(type, options);
    return explainValue(type, options);
};
