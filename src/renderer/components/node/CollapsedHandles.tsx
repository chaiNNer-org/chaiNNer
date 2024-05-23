import { NeverType } from '@chainner/navi';
import { Box } from '@chakra-ui/react';
import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { useContextSelector } from 'use-context-selector';
import { Output } from '../../../common/common-types';
import { FunctionDefinition } from '../../../common/types/function';
import { stringifySourceHandle, stringifyTargetHandle } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { defaultColor } from '../../helpers/accentColors';
import { NodeState } from '../../helpers/nodeState';
import { useSourceTypeColors } from '../../hooks/useSourceTypeColor';
import { useTypeColor } from '../../hooks/useTypeColor';

interface InputHandleProps {
    isIterated: boolean;
    targetHandle: string;
}

const InputHandle = memo(({ isIterated, targetHandle }: InputHandleProps) => {
    const sourceTypeColor = useSourceTypeColors(targetHandle)?.[0] ?? defaultColor;

    return (
        <Box
            h="6px"
            mr="auto"
            position="relative"
            w="6px"
        >
            <Handle
                className="input-handle"
                id={targetHandle}
                isConnectable={false}
                position={Position.Left}
                style={{
                    borderColor: sourceTypeColor,
                    borderRadius: isIterated ? '10%' : '50%',
                }}
                type="target"
            />
        </Box>
    );
});

interface OutputHandleProps {
    output: Output;
    nodeState: NodeState;
    functionDefinition: FunctionDefinition | undefined;
    isIterated: boolean;
    sourceHandle: string;
}

const OutputHandle = memo(
    ({ output, nodeState, functionDefinition, isIterated, sourceHandle }: OutputHandleProps) => {
        const functions = functionDefinition?.outputDefaults;
        const definitionType = functions?.get(output.id) ?? NeverType.instance;
        const type = nodeState.type.instance?.outputs.get(output.id);

        const handleColors = useTypeColor(type || definitionType);

        return (
            <Box
                h="6px"
                key={sourceHandle}
                ml="auto"
                position="relative"
                w="6px"
            >
                <Handle
                    className="output-handle"
                    id={sourceHandle}
                    isConnectable={false}
                    position={Position.Right}
                    style={{
                        borderColor: handleColors[0],
                        borderRadius: isIterated ? '10%' : '50%',
                    }}
                    type="source"
                />
            </Box>
        );
    }
);

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

                        const targetHandle = stringifyTargetHandle({ nodeId, inputId: input.id });

                        return (
                            <InputHandle
                                isIterated={isIterated}
                                key={targetHandle}
                                targetHandle={targetHandle}
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
                        const isConnected = nodeState.connectedOutputs.has(output.id);
                        if (!isConnected) {
                            return null;
                        }
                        const isIterated = iteratedOutputs.has(output.id);
                        const sourceHandle = stringifySourceHandle({ nodeId, outputId: output.id });
                        return (
                            <OutputHandle
                                functionDefinition={functionDefinition}
                                isIterated={isIterated}
                                key={output.id}
                                nodeState={nodeState}
                                output={output}
                                sourceHandle={sourceHandle}
                            />
                        );
                    })}
                </Box>
            </Box>
        </>
    );
});
