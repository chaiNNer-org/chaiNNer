import { checkAssignedLineage } from '../../common/nodes/checkNodeValidity';
import { EdgeState } from '../../common/nodes/EdgeState';
import { ChainLineage } from '../../common/nodes/lineage';
import { TypeState } from '../../common/nodes/TypeState';
import {
    generateAssignmentErrorTrace,
    printErrorTrace,
    simpleError,
} from '../../common/types/mismatch';
import { withoutNull } from '../../common/types/util';
import { EMPTY_ARRAY, ParsedSourceHandle, ParsedTargetHandle } from '../../common/util';
import { VALID, Validity, invalid } from '../../common/Validity';

const canReach = (from: string, to: string, edges: EdgeState): boolean => {
    // DFS
    const visited = new Set<string>();
    const stack = [from];

    let current;
    // eslint-disable-next-line no-cond-assign
    while ((current = stack.pop())) {
        if (current === to) return true;
        if (!visited.has(current)) {
            visited.add(current);

            for (const edge of edges.byTarget.get(current) ?? EMPTY_ARRAY) {
                stack.push(edge.source);
            }
        }
    }
    return false;
};

/**
 * Returns whether the connection made between the two handles is valid,
 * assuming that it replaces any connections to the target handle.
 */
export const canConnect = (
    sourceHandle: ParsedSourceHandle,
    targetHandle: ParsedTargetHandle,
    typeState: TypeState,
    chainLineage: ChainLineage
): Validity => {
    const sourceOutputId = sourceHandle.outputId;
    const targetInputId = targetHandle.inputId;

    // Cycle check
    if (sourceHandle.nodeId === targetHandle.nodeId) {
        return invalid('Cannot connect a node to itself.');
    }
    if (canReach(sourceHandle.nodeId, targetHandle.nodeId, typeState.edges)) {
        return invalid('Connection would create an infinite loop.');
    }

    // Type check
    const sourceFn = typeState.functions.get(sourceHandle.nodeId);
    const targetFn = typeState.functions.get(targetHandle.nodeId);

    if (!sourceFn || !targetFn) {
        return invalid('Invalid connection data.');
    }

    const targetSchema = targetFn.definition.schema;

    const outputType = sourceFn.outputs.get(sourceOutputId);
    if (outputType !== undefined && !targetFn.canAssign(targetInputId, outputType)) {
        const schema = targetSchema;
        const input = schema.inputs.find((i) => i.id === targetInputId)!;
        const inputType = withoutNull(targetFn.definition.inputDefaults.get(targetInputId)!);

        const error = simpleError(outputType, inputType);
        if (error) {
            return invalid(
                `Input ${input.label} requires ${error.definition} but would be connected with ${error.assigned}.`
            );
        }

        const traceTree = generateAssignmentErrorTrace(outputType, inputType);
        if (!traceTree) throw new Error('Cannot determine assignment error');
        const trace = printErrorTrace(traceTree);
        return invalid(
            `Input ${input.label} cannot be connected with an incompatible value. ${trace.join(
                ' '
            )}`
        );
    }

    // Iterator lineage check
    const sourceLineage = chainLineage.getOutputLineage(sourceHandle);
    const lineageValid = checkAssignedLineage(
        sourceLineage,
        targetHandle.nodeId,
        targetHandle.inputId,
        targetSchema,
        chainLineage
    );
    if (!lineageValid.isValid) {
        return lineageValid;
    }

    // all checks passed
    return VALID;
};
