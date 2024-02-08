import { useMemo } from 'react';
import { Node, useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { InputId, NodeData } from '../../common/common-types';
import { parseSourceHandle, parseTargetHandle } from '../../common/util';
import { BackendContext } from '../contexts/BackendContext';
import { GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { defaultColor, getTypeAccentColors } from '../helpers/accentColors';

export const useSourceTypeColor = (nodeId: string, inputId: InputId) => {
    const { functionDefinitions } = useContext(BackendContext);
    const { edgeChanges, typeState } = useContext(GlobalVolatileContext);
    const { getEdges, getNode } = useReactFlow();

    const connectedEdge = useMemo(() => {
        return getEdges().find(
            (e) => e.target === nodeId && parseTargetHandle(e.targetHandle!).inputId === inputId
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [edgeChanges, getEdges, nodeId, inputId]);

    const sourceTypeColor = useMemo(() => {
        if (connectedEdge) {
            const sourceNode: Node<NodeData> | undefined = getNode(connectedEdge.source);
            const sourceOutputId = parseSourceHandle(connectedEdge.sourceHandle!).outputId;
            if (sourceNode) {
                const sourceDef = functionDefinitions.get(sourceNode.data.schemaId);
                if (!sourceDef) {
                    return defaultColor;
                }
                const sourceType =
                    typeState.functions.get(sourceNode.id)?.outputs.get(sourceOutputId) ??
                    sourceDef.outputDefaults.get(sourceOutputId);
                if (!sourceType) {
                    return defaultColor;
                }
                return getTypeAccentColors(sourceType)[0];
            }
            return defaultColor;
        }
        return null;
    }, [connectedEdge, functionDefinitions, typeState, getNode]);

    return sourceTypeColor;
};
