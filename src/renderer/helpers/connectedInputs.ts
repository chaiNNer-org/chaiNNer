import { Edge } from 'reactflow';
import { EdgeData, InputId } from '../../common/common-types';
import { parseTargetHandle } from '../../common/util';

export const getConnectedInputs = (
    nodeId: string,
    edges: readonly Edge<EdgeData>[]
): Set<InputId> => {
    const targetedInputs = edges
        .filter((e) => e.target === nodeId && e.targetHandle)
        .map((e) => parseTargetHandle(e.targetHandle!).inOutId);
    return new Set(targetedInputs);
};
