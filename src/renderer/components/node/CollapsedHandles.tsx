import { NeverType } from '@chainner/navi';
import { Box } from '@chakra-ui/react';
import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { useContextSelector } from 'use-context-selector';
import { InputId } from '../../../common/common-types';
import { stringifySourceHandle, stringifyTargetHandle } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { defaultColor, getTypeAccentColors } from '../../helpers/accentColors';
import { NodeState } from '../../helpers/nodeState';
import { useSourceTypeColor } from '../../hooks/useSourceTypeColor';
import { getBackground } from '../Handle';

interface InputHandleProps {
    nodeId: string;
    inputId: InputId;
    isIterated: boolean;
    handleId: string;
}

const InputHandle = memo(({ nodeId, isIterated, inputId, handleId }: InputHandleProps) => {
    const sourceTypeColor = useSourceTypeColor(nodeId, inputId);

    return (
        <Box
            h="6px"
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

                        const handleId = stringifyTargetHandle({ nodeId, inputId: input.id });

                        return (
                            <InputHandle
                                handleId={handleId}
                                inputId={input.id}
                                isIterated={isIterated}
                                key={handleId}
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
