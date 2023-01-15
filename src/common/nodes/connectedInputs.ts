import { Type } from '@chainner/navi';
import { EdgeData, InputId, OutputId } from '../common-types';
import { FunctionDefinition } from '../types/function';
import { parseTargetHandle } from '../util';
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

export const getFirstPossibleInput = (fn: FunctionDefinition, type: Type): InputId | undefined =>
    fn.schema.inputs.find((i) => i.hasHandle && fn.canAssignInput(i.id, type))?.id;
export const getFirstPossibleOutput = (fn: FunctionDefinition, type: Type): OutputId | undefined =>
    fn.schema.outputs.find((o) => o.hasHandle && fn.canAssignOutput(o.id, type))?.id;
