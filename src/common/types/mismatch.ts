import {
    IntIntervalType,
    IntersectionExpression,
    NamedExpression,
    NumericLiteralType,
    StructType,
    Type,
    evaluate,
    isDisjointWith,
} from '@chainner/navi';
import { assertNever } from '../util';
import { getChainnerScope } from './chainner-scope';
import { prettyPrintType } from './pretty';
import { IntNumberType, isColor, isImage } from './util';

export type AssignmentErrorTrace = FieldAssignmentError | GeneralAssignmentError;
export interface GeneralAssignmentError {
    type: 'General';
    assigned: Type;
    definition: Type;
}
export interface FieldAssignmentError {
    type: 'Field';
    assigned: StructType;
    definition: StructType;
    field: string;
    inner: AssignmentErrorTrace;
}

export const generateAssignmentErrorTrace = (
    assigned: Type,
    definition: Type
): AssignmentErrorTrace | undefined => {
    if (!isDisjointWith(assigned, definition)) {
        // types compatible
        return undefined;
    }

    if (
        assigned.type === 'struct' &&
        definition.type === 'struct' &&
        assigned.name === definition.name
    ) {
        // find the first field that causes the mismatch
        for (let i = 0; i < assigned.fields.length; i += 1) {
            const a = assigned.fields[i];
            const d = definition.fields[i];

            const inner = generateAssignmentErrorTrace(a.type, d.type);
            if (inner) {
                return {
                    type: 'Field',
                    assigned,
                    definition,
                    field: a.name,
                    inner,
                };
            }
        }
    }

    return { type: 'General', assigned, definition };
};

const shortTypeNames = (t: Type): Set<string> => {
    switch (t.underlying) {
        case 'any':
        case 'number':
        case 'string':
            return new Set([t.underlying]);
        case 'never':
            return new Set();
        case 'struct':
            return new Set([t.name]);
        case 'union':
            return new Set(t.items.flatMap((i) => [...shortTypeNames(i)]));
        default:
            return assertNever(t);
    }
};

const areSetsDisjoint = <T>(a: Iterable<T>, b: ReadonlySet<T>): boolean => {
    for (const item of a) {
        if (b.has(item)) return false;
    }
    return true;
};

const shortTypeComparison = (
    a: Type,
    b: Type,
    toString: (t: Type) => string
): [a: string, b: string] => {
    const aNames = shortTypeNames(a);
    const bNames = shortTypeNames(b);

    if (aNames.size > 0 && bNames.size > 0 && areSetsDisjoint(aNames, bNames)) {
        return [[...aNames].join(' | '), [...bNames].join(' | ')];
    }

    return [toString(a), toString(b)];
};

export const printErrorTrace = (trace: AssignmentErrorTrace): string[] => {
    const { assigned, definition } = trace;

    if (trace.type === 'General') {
        const [a, d] = shortTypeComparison(assigned, definition, prettyPrintType);
        return [`The type **${a}** is not connectable with type **${d}**.`];
    }

    if (trace.inner.type === 'General') {
        const [a, d] = shortTypeComparison(
            trace.inner.assigned,
            trace.inner.definition,
            prettyPrintType
        );
        return [
            `The **${trace.assigned.name}** types are incompatible because **${trace.field}: ${a}** is not connectable with **${trace.field}: ${d}**.`,
        ];
    }

    return [
        `The type **${prettyPrintType(assigned)}** is not connectable with **${prettyPrintType(
            definition
        )}** because the **${trace.field}** fields are incompatible.`,
        ...printErrorTrace(trace.inner),
    ];
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
const formatChannelNumber = (n: IntNumberType, subject = 'image'): string | undefined => {
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
const explainNumber = (n: Type): string | undefined => {
    if (n.underlying === 'number') {
        if (n.type === 'number') return 'a number';
        if (n.type === 'literal') return `the number ${n.value}`;

        const kind = n.type === 'int-interval' ? 'an integer' : 'a number';
        if (n.min === -Infinity && n.max === Infinity) return kind;
        if (n.min === -Infinity) return `${kind} that is at most ${n.max}`;
        if (n.max === Infinity) return `${kind} that is at least ${n.min}`;
        return `${kind} between ${n.min} and ${n.max}`;
    }
    return undefined;
};

export const simpleError = (
    assigned: Type,
    definition: Type
): { assigned: string; definition: string } | undefined => {
    // image channel mismatch
    if (isImage(assigned)) {
        const d = evaluate(
            new IntersectionExpression([definition, new NamedExpression('Image')]),
            getChainnerScope()
        );

        if (isImage(d)) {
            const aChannels = assigned.fields[2].type;
            const dChannels = d.fields[2].type;

            if (isDisjointWith(aChannels, dChannels)) {
                const aString = formatChannelNumber(aChannels);
                const dString = formatChannelNumber(dChannels);
                if (aString && dString) {
                    return {
                        assigned: aString,
                        definition: dString,
                    };
                }
            }
        }
    }

    // color channel mismatch
    if (isColor(assigned)) {
        const d = evaluate(
            new IntersectionExpression([definition, new NamedExpression('Color')]),
            getChainnerScope()
        );

        if (isColor(d)) {
            const aChannels = assigned.fields[0].type;
            const dChannels = d.fields[0].type;

            if (isDisjointWith(aChannels, dChannels)) {
                const aString = formatChannelNumber(aChannels, 'color');
                const dString = formatChannelNumber(dChannels, 'color');
                if (aString && dString) {
                    return {
                        assigned: aString,
                        definition: dString,
                    };
                }
            }
        }
    }

    // number mismatch
    const assignedNumber = explainNumber(assigned);
    const definitionNumber = explainNumber(definition);
    if (assignedNumber && definitionNumber) {
        return {
            assigned: assignedNumber,
            definition: definitionNumber,
        };
    }

    return undefined;
};
