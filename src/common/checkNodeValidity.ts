import { Input, InputData, InputId, NodeSchema } from './common-types';
import { FunctionInstance } from './types/function';
import { generateAssignmentErrorTrace, printErrorTrace, simpleError } from './types/mismatch';

export type Validity =
    | { readonly isValid: true }
    | { readonly isValid: false; readonly reason: string };

export const VALID: Validity = { isValid: true };

const formatMissingInputs = (missingInputs: Input[]) => {
    return `Missing required input data: ${missingInputs.map((input) => input.label).join(', ')}`;
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

            const error = simpleError(assignedType, inputType);
            if (error) {
                return {
                    isValid: false,
                    reason: `Input ${input.label} requires ${error.definition} but was connected with ${error.assigned}.`,
                };
            }
        }

        if (functionInstance.inputErrors.length > 0) {
            const { inputId, assignedType, inputType } = functionInstance.inputErrors[0];
            const input = schema.inputs.find((i) => i.id === inputId)!;
            const traceTree = generateAssignmentErrorTrace(assignedType, inputType);
            if (!traceTree) throw new Error('Cannot determine assignment error');
            const trace = printErrorTrace(traceTree);
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
