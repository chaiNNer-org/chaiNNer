import { useMemo } from 'react';
import { Node, useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { NodeData } from '../../common/common-types';
import { parseSourceHandle } from '../../common/util';
import { BackendContext } from '../contexts/BackendContext';
import { GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { useTypeColor } from './useTypeColor';

export const useSourceTypeColor = (targetHandle: string) => {
    const { functionDefinitions } = useContext(BackendContext);
    const { edgeChanges, typeState } = useContext(GlobalVolatileContext);
    const { getEdges, getNode } = useReactFlow();

    const sourceHandle = useMemo(() => {
        return getEdges().find((e) => e.targetHandle === targetHandle)?.sourceHandle;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [edgeChanges, getEdges, targetHandle]);

    const sourceType = useMemo(() => {
        if (sourceHandle) {
            const source = parseSourceHandle(sourceHandle);
            const sourceNode: Node<NodeData> | undefined = getNode(source.nodeId);
            if (sourceNode) {
                const sourceDef = functionDefinitions.get(sourceNode.data.schemaId);
                if (!sourceDef) {
                    return;
                }
                return (
                    typeState.functions.get(source.nodeId)?.outputs.get(source.outputId) ??
                    sourceDef.outputDefaults.get(source.outputId)
                );
            }
        }
    }, [sourceHandle, functionDefinitions, typeState, getNode]);

    const sourceTypeColor = useTypeColor(sourceType);

    return sourceTypeColor[0];
};
