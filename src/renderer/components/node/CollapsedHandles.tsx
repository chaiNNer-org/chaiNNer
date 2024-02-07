import { NeverType } from '@chainner/navi';
import { Box } from '@chakra-ui/react';
import { memo, useMemo } from 'react';
import { Handle, Node, Position, useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { InputId, NodeData } from '../../../common/common-types';
import {
    parseSourceHandle,
    parseTargetHandle,
    stringifySourceHandle,
    stringifyTargetHandle,
} from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { defaultColor, getTypeAccentColors } from '../../helpers/accentColors';
import { NodeState } from '../../helpers/nodeState';
import { getBackground } from '../Handle';

interface InputHandleProps {
    nodeId: string;
    inputId: InputId;
    isIterated: boolean;
}

const InputHandle = memo(({ nodeId, isIterated, inputId }: InputHandleProps) => {
    const { edgeChanges, typeState } = useContext(GlobalVolatileContext);
    const { getEdges, getNode } = useReactFlow();

    const connectedEdge = useMemo(() => {
        return getEdges().find(
            (e) => e.target === nodeId && parseTargetHandle(e.targetHandle!).inputId === inputId
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [edgeChanges, getEdges, nodeId, inputId]);

    const { functionDefinitions } = useContext(BackendContext);

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

    const handleId = stringifyTargetHandle({ nodeId, inputId });

    return (
        <Box
            h="6px"
            key={handleId}
            mr="auto"
            position="relative"
            w="6px"
        >
            <Handle
                className="input-handle"
                id={handleId}
                isConnectable={false}
                position={Position.Left}
                style={{
                    borderColor: sourceTypeColor || defaultColor,
                    borderRadius: isIterated ? '10%' : '50%',
                }}
                type="target"
            />
        </Box>
    );
});

interface CollapsedHandlesProps {
    nodeState: NodeState;
}

export const CollapsedHandles = memo(({ nodeState }: CollapsedHandlesProps) => {
    const functionDefinition = useContextSelector(BackendContext, (c) =>
        c.functionDefinitions.get(nodeState.schemaId)
    );

    const { inputs, outputs } = nodeState.schema;

    const { iteratedInputs, iteratedOutputs, id: nodeId } = nodeState;

    return (
        <>
            <Box
                alignItems="center"
                bottom={0}
                display="flex"
                left="-1px"
                position="absolute"
                top={0}
            >
                <Box>
                    {inputs.map((input) => {
                        const isConnected = nodeState.connectedInputs.has(input.id);

                        if (!isConnected) {
                            return null;
                        }

                        const isIterated = iteratedInputs.has(input.id);

                        return (
                            <InputHandle
                                inputId={input.id}
                                isIterated={isIterated}
                                nodeId={nodeId}
                            />
                        );
                    })}
                </Box>
            </Box>
            <Box
                alignItems="center"
                bottom={0}
                display="flex"
                position="absolute"
                right="-1px"
                top={0}
            >
                <Box>
                    {outputs.map((output) => {
                        const functions = functionDefinition?.outputDefaults;
                        const definitionType = functions?.get(output.id) ?? NeverType.instance;
                        const type = nodeState.type.instance?.outputs.get(output.id);

                        const isConnected = nodeState.connectedOutputs.has(output.id);

                        if (!isConnected) {
                            return null;
                        }

                        const handleColors = getTypeAccentColors(type || definitionType);

                        const isIterated = iteratedOutputs.has(output.id);

                        const handleId = stringifySourceHandle({ nodeId, outputId: output.id });

                        return (
                            <Box
                                h="6px"
                                key={handleId}
                                ml="auto"
                                position="relative"
                                w="6px"
                            >
                                <Handle
                                    className="output-handle"
                                    id={handleId}
                                    isConnectable={false}
                                    position={Position.Right}
                                    style={{
                                        borderColor: getBackground(handleColors),
                                        borderRadius: isIterated ? '10%' : '50%',
                                    }}
                                    type="source"
                                />
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </>
    );
});
