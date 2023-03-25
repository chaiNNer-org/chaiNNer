import { Input, InputData, InputId, NodeSchema } from '../common-types';
import { FunctionInstance } from '../types/function';
import { generateAssignmentErrorTrace, printErrorTrace, simpleError } from '../types/mismatch';
import { withoutNull } from '../types/util';
import { VALID, Validity, invalid } from '../Validity';
import { testInputCondition } from './condition';
import { getRequireConditions } from './required';

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
    const isOptional = (input: Input): boolean => {
        if (input.kind !== 'generic' || !input.optional) {
            return input.optional;
        }

        // this generic input is declared as optional, but it might still be required by a group
        const condition = getRequireConditions(schema).get(input.id);
        if (!condition) {
            // there is no condition, so the input is optional
            return true;
        }

        return !testInputCondition(
            condition,
            inputData,
            (id) => functionInstance?.inputs.get(id),
            (id) => connectedInputs.has(id)
        );
    };

    const missingInputs = schema.inputs.filter((input) => {
        // optional inputs can't be missing
        if (isOptional(input)) return false;

        const inputValue = inputData[input.id];
        // a value is assigned
        if (inputValue !== undefined) return false;

        // the value of the input is assigned by an edge
        if (connectedInputs.has(input.id)) return false;

        return true;
    });

    if (missingInputs.length) {
        return invalid(formatMissingInputs(missingInputs));
    }

    if (functionInstance) {
        for (const { inputId, assignedType, inputType } of functionInstance.inputErrors) {
            const input = schema.inputs.find((i) => i.id === inputId)!;

            const error = simpleError(assignedType, withoutNull(inputType));
            if (error) {
                return invalid(
                    `Input ${input.label} requires ${error.definition} but was connected with ${error.assigned}.`
                );
            }
        }

        if (functionInstance.inputErrors.length > 0) {
            const { inputId, assignedType, inputType } = functionInstance.inputErrors[0];
            const input = schema.inputs.find((i) => i.id === inputId)!;
            const traceTree = generateAssignmentErrorTrace(assignedType, withoutNull(inputType));
            if (!traceTree) throw new Error('Cannot determine assignment error');
            const trace = printErrorTrace(traceTree);
            return invalid(
                `Input ${input.label} was connected with an incompatible value. ${trace.join(' ')}`
            );
        }

        // eslint-disable-next-line no-unreachable-loop
        for (const { outputId } of functionInstance.outputErrors) {
            const output = schema.outputs.find((o) => o.id === outputId)!;

            return invalid(
                `Some inputs are incompatible with each other. ${output.neverReason ?? ''}`
            );
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
