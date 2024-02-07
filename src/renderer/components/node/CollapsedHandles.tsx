import { NeverType } from '@chainner/navi';
import { Box } from '@chakra-ui/react';
import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { useContextSelector } from 'use-context-selector';
import { stringifySourceHandle, stringifyTargetHandle } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { getTypeAccentColors } from '../../helpers/accentColors';
import { NodeState } from '../../helpers/nodeState';
import { getBackground } from '../Handle';

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

                        const connectableType =
                            functionDefinition?.inputConvertibleDefaults.get(input.id) ??
                            NeverType.instance;
                        const handleColors = getTypeAccentColors(connectableType);

                        const isIterated = iteratedInputs.has(input.id);

                        const handleId = stringifyTargetHandle({ nodeId, inputId: input.id });

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
                                        borderColor: getBackground(handleColors),
                                        borderRadius: isIterated ? '10%' : '50%',
                                    }}
                                    type="target"
                                />
                            </Box>
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
