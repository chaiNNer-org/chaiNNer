import { Edge } from 'react-flow-renderer';
import { EdgeData, Input, InputData, NodeSchema } from '../../common/common-types';
import { getChainnerScope } from '../../common/types/chainner-scope';
import { evaluate } from '../../common/types/evaluate';
import { IntersectionExpression, NamedExpression } from '../../common/types/expression';
import { FunctionInstance } from '../../common/types/function';
import { isDisjointWith } from '../../common/types/intersection';
import { IntIntervalType, NumericLiteralType, Type } from '../../common/types/types';
import { IntNumberType, isImage } from '../../common/types/util';
import { parseTargetHandle } from '../../common/util';

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

export interface CheckNodeValidityOptions {
    id: string;
    schema: NodeSchema;
    inputData: InputData;
    edges: readonly Edge<EdgeData>[];
    functionInstance: FunctionInstance | undefined;
}
export const checkNodeValidity = ({
    id,
    schema,
    inputData,
    edges,
    functionInstance,
}: CheckNodeValidityOptions): Validity => {
    const targetedInputs = edges
        .filter((e) => e.target === id && e.targetHandle)
        .map((e) => parseTargetHandle(e.targetHandle!).inOutId);

    const missingInputs = schema.inputs.filter((input) => {
        // optional inputs can't be missing
        if (input.optional) return false;

        const inputValue = inputData[input.id];
        // a value is assigned
        if (inputValue !== undefined) return false;

        // the value of the input is assigned by an edge
        if (targetedInputs.includes(input.id)) return false;

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
