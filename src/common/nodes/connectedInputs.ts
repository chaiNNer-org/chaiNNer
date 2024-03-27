import { Type } from '@chainner/navi';
import { EdgeData, InputId, OutputId } from '../common-types';
import { FunctionDefinition } from '../types/function';
import { parseTargetHandle } from '../util';
import { isAutoIterable } from './lineage';
import type { Edge } from 'reactflow';

export const getConnectedInputs = (
    nodeId: string,
    edges: readonly Edge<EdgeData>[]
): Set<InputId> => {
    const targetedInputs = edges
        .filter((e) => e.target === nodeId && e.targetHandle)
        .map((e) => parseTargetHandle(e.targetHandle!).inputId);
    return new Set(targetedInputs);
};

/**
 * Returns the first compatible input that can be assigned the given type.
 * If `isIterated` is true, then the input will be given an iterator.
 */
export const getFirstPossibleInput = (
    fn: FunctionDefinition,
    type: Type,
    isIterated: boolean
): InputId | undefined => {
    return fn.schema.inputs.find((i) => {
        // check if the input has a handle
        if (!i.hasHandle) return false;

        if (!isAutoIterable(fn.schema)) {
            const inputIterated = fn.schema.iteratorInputs.some((info) =>
                info.inputs.includes(i.id)
            );
            if (inputIterated !== isIterated) return false;
        }

        return fn.canAssignInput(i.id, type);
    })?.id;
};
export const getFirstPossibleOutput = (
    outputFn: FunctionDefinition,
    inputFn: FunctionDefinition,
    inputId: InputId
): OutputId | undefined => {
    if (!inputFn.hasInput(inputId)) return undefined;

    let allowIterated = false;
    let allowNonIterated = false;
    if (isAutoIterable(inputFn.schema)) {
        allowIterated = true;
        allowNonIterated = true;
    } else {
        const inputIterated = inputFn.schema.iteratorInputs.some((i) => i.inputs.includes(inputId));
        allowIterated = inputIterated;
        allowNonIterated = !inputIterated;
    }

    return outputFn.schema.outputs.find((o) => {
        // check if the output has a handle
        if (!o.hasHandle) return false;

        // check iterator compatibility
        const outputIterated = outputFn.schema.iteratorOutputs.some((info) =>
            info.outputs.includes(o.id)
        );
        if (!allowIterated && outputIterated) return false;
        if (!allowNonIterated && !isAutoIterable(outputFn.schema) && !outputIterated) return false;

        // type check
        const type = outputFn.outputDefaults.get(o.id);
        return type && inputFn.canAssignInput(inputId, type);
    })?.id;
};
