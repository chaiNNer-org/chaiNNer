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
import { Input, InputData, InputId, NodeSchema } from './common-types';
import { getChainnerScope } from './types/chainner-scope';
import { FunctionInstance } from './types/function';
import { IntNumberType, isImage } from './types/util';
import { assertNever } from './util';

export type Validity =
    | { readonly isValid: true }
    | { readonly isValid: false; readonly reason: string };

export const VALID: Validity = { isValid: true };

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
const formatChannelNumber = (n: IntNumberType): string | undefined => {
    const numbers = getAcceptedNumbers(n);
    if (!numbers) return undefined;

    const known: string[] = [];
    if (numbers.has(1)) known.push('grayscale');
    if (numbers.has(3)) known.push('RGB');
    if (numbers.has(4)) known.push('RGBA');

    if (known.length === numbers.size) {
        const article = known[0] === 'grayscale' ? 'a' : 'an';
        if (known.length === 1) return `${article} ${known[0]} image`;
        if (known.length === 2) return `${article} ${known[0]} or ${known[1]} image`;
        if (known.length === 3) return `${article} ${known[0]}, ${known[1]} or ${known[2]} image`;
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

const formatMissingInputs = (missingInputs: Input[]) => {
    return `Missing required input data: ${missingInputs.map((input) => input.label).join(', ')}`;
};

type AssignmentErrorTrace = FieldAssignmentError | GeneralAssignmentError;
interface GeneralAssignmentError {
    type: 'General';
    assigned: Type;
    definition: Type;
}
interface FieldAssignmentError {
    type: 'Field';
    assigned: StructType;
    definition: StructType;
    field: string;
    inner: AssignmentErrorTrace;
}

const generateAssignmentErrorTrace = (assigned: Type, definition: Type): AssignmentErrorTrace => {
    if (
        assigned.type === 'struct' &&
        definition.type === 'struct' &&
        assigned.name === definition.name
    ) {
        // find the field that causes the mismatch
        const mismatchIndex = assigned.fields.findIndex((a, i) => {
            return isDisjointWith(a.type, definition.fields[i].type);
        });

        if (mismatchIndex !== -1) {
            const a = assigned.fields[mismatchIndex];
            const d = definition.fields[mismatchIndex];

            return {
                type: 'Field',
                assigned,
                definition,
                field: a.name,

                inner: generateAssignmentErrorTrace(a.type, d.type),
            };
        }
    }

    return { type: 'General', assigned, definition };
};

const prettyPrintType = (type: Type): string => {
    switch (type.type) {
        case 'any':
        case 'never':
        case 'literal':
        case 'number':
        case 'string':
        case 'interval':
            return type.toString();

        case 'inverted-set':
            return `not(${[...type.excluded].map((s) => JSON.stringify(s)).join(' | ')})`;

        case 'int-interval':
            if (type.min === -Infinity && type.max === Infinity) {
                return 'int';
            }
            if (type.min === 0 && type.max === Infinity) {
                return 'uint';
            }
            return type.toString();

        case 'union':
            return type.items.map(prettyPrintType).join(' | ');

        case 'struct':
            if (type.fields.length === 0) return type.name;
            return `${type.name} { ${type.fields
                .map((f) => `${f.name}: ${prettyPrintType(f.type)}`)
                .join(', ')} }`;

        default:
            return assertNever(type);
    }
};

const shortTypeComparison = (
    a: Type,
    b: Type,
    toString: (t: Type) => string
): [a: string, b: string] => {
    if (a.type === 'struct') {
        if (b.type === 'struct' && b.name !== a.name) {
            return [a.name, b.name];
        }
        if (b.type === 'union' && b.items.every((i) => i.type !== 'struct' || i.name !== a.name)) {
            return [a.name, toString(b)];
        }
    }
    if (b.type === 'struct') {
        if (a.type === 'union' && a.items.every((i) => i.type !== 'struct' || i.name !== b.name)) {
            return [toString(a), b.name];
        }
    }
    return [toString(a), toString(b)];
};

const printErrorTrace = (trace: AssignmentErrorTrace): string[] => {
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

export interface CheckNodeValidityOptions {
    schema: NodeSchema;
    inputData: InputData;
    connectedInputs: ReadonlySet<InputId>;
    functionInstance: FunctionInstance | undefined;
}
export const checkNodeValidity = ({
    schema,
    inputData,
    connectedInputs,
    functionInstance,
}: CheckNodeValidityOptions): Validity => {
    const missingInputs = schema.inputs.filter((input) => {
        // optional inputs can't be missing
        if (input.optional) return false;

        const inputValue = inputData[input.id];
        // a value is assigned
        if (inputValue !== undefined) return false;

        // the value of the input is assigned by an edge
        if (connectedInputs.has(input.id)) return false;

        return true;
    });

    if (missingInputs.length) {
        return {
            isValid: false,
            reason: formatMissingInputs(missingInputs),
        };
    }

    if (functionInstance) {
        for (const { inputId, assignedType, inputType } of functionInstance.inputErrors) {
            const input = schema.inputs.find((i) => i.id === inputId)!;

            // image channel mismatch
            if (isImage(assignedType)) {
                const iType = evaluate(
                    new IntersectionExpression([inputType, new NamedExpression('Image')]),
                    getChainnerScope()
                );
                if (isImage(iType)) {
                    const assignedChannels = assignedType.fields[2].type;
                    const inputChannels = iType.fields[2].type;

                    if (isDisjointWith(assignedChannels, inputChannels)) {
                        const expected = formatChannelNumber(inputChannels);
                        const assigned = formatChannelNumber(assignedChannels);
                        if (expected && assigned) {
                            return {
                                isValid: false,
                                reason: `Input ${input.label} requires ${expected} but was connected with ${assigned}.`,
                            };
                        }
                    }
                }
            }

            // number mismatch
            const assignedNumber = explainNumber(assignedType);
            const inputNumber = explainNumber(inputType);
            if (assignedNumber && inputNumber) {
                return {
                    isValid: false,
                    reason: `Input ${input.label} requires ${inputNumber} but was connected with ${assignedNumber}.`,
                };
            }
        }

        if (functionInstance.inputErrors.length > 0) {
            const { inputId, assignedType, inputType } = functionInstance.inputErrors[0];
            const input = schema.inputs.find((i) => i.id === inputId)!;
            const trace = printErrorTrace(generateAssignmentErrorTrace(assignedType, inputType));
            return {
                isValid: false,
                reason: `Input ${
                    input.label
                } was connected with an incompatible value. ${trace.join(' ')}`,
            };
        }

        // eslint-disable-next-line no-unreachable-loop
        for (const { outputId } of functionInstance.outputErrors) {
            const output = schema.outputs.find((o) => o.id === outputId)!;

            return {
                isValid: false,
                reason: `Some inputs are incompatible with each other. ${output.neverReason ?? ''}`,
            };
        }
    }

    return VALID;
};

/**
 * This is a fast approximation of the full validity check. It does not take into account edges
 * and types. A node will only be found invalid if one of its inputs is guaranteed to be missing.
 */
export const checkRequiredInputs = (schema: NodeSchema, inputData: InputData): Validity => {
    const missingInputs = schema.inputs.filter((input) => {
        // optional inputs can't be missing
        if (input.optional) return false;

        const inputValue = inputData[input.id];
        // a value is assigned
        if (inputValue !== undefined) return false;

        // an edge *might* be connected, so we can't guarantee that the input is missing
        if (input.hasHandle) return false;

        return true;
    });

    if (missingInputs.length === 0) return VALID;

    return {
        isValid: false,
        reason: formatMissingInputs(missingInputs),
    };
};
