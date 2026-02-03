import { Input, InputData, InputId, NodeSchema } from '../common-types';
import { FunctionInstance } from '../types/function';
import { generateAssignmentErrorTrace, printErrorTrace, simpleError } from '../types/mismatch';
import { withoutNull } from '../types/util';
import { assertNever } from '../util';
import { VALID, Validity, invalid } from '../Validity';
import { testInputCondition } from './condition';
import { getGroupStacks, getRequireConditions } from './groupStacks';
import { ChainLineage, Lineage } from './lineage';

const formatMissingInputs = (missingInputs: Input[]) => {
    return `Missing required input data: ${missingInputs.map((input) => input.label).join(', ')}`;
};

export interface CheckNodeValidityOptions {
    schema: NodeSchema;
    inputData: InputData;
    connectedInputs: ReadonlySet<InputId>;
    functionInstance: FunctionInstance | undefined;
    chainLineage: ChainLineage | undefined;
    nodeId: string;
}
export const checkNodeValidity = ({
    schema,
    inputData,
    connectedInputs,
    functionInstance,
    chainLineage,
    nodeId,
}: CheckNodeValidityOptions): Validity => {
    const groupStacks = getGroupStacks(schema);
    const isOptional = (input: Input): boolean => {
        // Check if input is inside a conditional group with a false condition
        const conditions = groupStacks.inputConditions.get(input.id) ?? [];
        if (conditions.length > 0) {
            // If any condition is false, the input is conditionally hidden and therefore optional
            const allConditionsTrue = conditions.every((c) =>
                testInputCondition(
                    c,
                    inputData,
                    schema,
                    (id) => functionInstance?.inputs.get(id),
                    (id) => connectedInputs.has(id)
                )
            );
            if (!allConditionsTrue) return true;
        }

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
            schema,
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

    // Type check
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

        // Sequence type check
        for (const { inputId, sequenceType, assignedSequenceType } of functionInstance.sequenceErrors) {
            const input = schema.inputs.find((i) => i.id === inputId)!;

            const error = simpleError(assignedSequenceType, sequenceType);
            if (error) {
                return invalid(
                    `Input ${input.label} requires sequence ${error.definition} but was connected with sequence ${error.assigned}.`
                );
            }
        }

        if (functionInstance.sequenceErrors.length > 0) {
            const { inputId, sequenceType, assignedSequenceType } = functionInstance.sequenceErrors[0];
            const input = schema.inputs.find((i) => i.id === inputId)!;
            const traceTree = generateAssignmentErrorTrace(assignedSequenceType, sequenceType);
            if (traceTree) {
                const trace = printErrorTrace(traceTree);
                return invalid(
                    `Input ${input.label} was connected with an incompatible sequence. ${trace.join(' ')}`
                );
            }
            return invalid(
                `Input ${input.label} was connected with an incompatible sequence length.`
            );
        }

        // eslint-disable-next-line no-unreachable-loop
        for (const { message } of functionInstance.outputErrors) {
            return invalid(`Some inputs are incompatible with each other. ${message ?? ''}`);
        }
    }

    // Lineage check
    if (chainLineage) {
        for (const input of schema.inputs) {
            const sourceLineage = chainLineage.getConnectedOutputLineage({
                nodeId,
                inputId: input.id,
            });
            if (sourceLineage !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                const lineageValid = checkAssignedLineage(sourceLineage, nodeId, input.id, schema);
                if (!lineageValid.isValid) {
                    return lineageValid;
                }
            }
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

        // Check if input is inside a conditional group
        const conditions = getGroupStacks(schema).inputConditions.get(input.id) ?? [];
        if (conditions.length > 0) {
            // Input is inside a conditional group, so it *might* be optional
            // We can't fully evaluate the condition without edges/types, so we assume it might be hidden
            return false;
        }

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

export const checkAssignedLineage = (
    sourceLineage: Lineage | null,
    nodeId: string,
    inputId: InputId,
    schema: NodeSchema
): Validity => {
    const input = schema.inputs.find((i) => i.id === inputId)!;

    const nonIteratorInput = () =>
        invalid(`Input ${input.label} cannot be connected to a sequence.`);

    switch (schema.kind) {
        case 'regularNode': {
            break;
        }
        case 'generator': {
            if (sourceLineage) {
                return nonIteratorInput();
            }
            break;
        }
        case 'collector': {
            const isIterated = schema.iteratorInputs[0].inputs.includes(inputId);
            if (isIterated) {
                if (!sourceLineage) {
                    return invalid(`Input ${input.label} expects a sequence.`);
                }
            } else if (sourceLineage) {
                return nonIteratorInput();
            }
            break;
        }
        case 'transformer': {
            const isIterated = schema.iteratorInputs[0].inputs.includes(inputId);
            if (isIterated) {
                if (!sourceLineage) {
                    return invalid(`Input ${input.label} expects a sequence.`);
                }
            } else if (sourceLineage) {
                return nonIteratorInput();
            }
            break;
        }
        default:
            return assertNever(schema.kind);
    }

    return VALID;
};
