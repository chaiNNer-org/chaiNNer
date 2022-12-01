import { Box, Center } from '@chakra-ui/react';
import { memo } from 'react';
import { Input, InputData, InputSize, NodeSchema } from '../../../common/common-types';
import { NodeInputs } from './NodeInputs';
import { NodeOutputs } from './NodeOutputs';

const isAutoInput = (input: Input): boolean =>
    input.kind === 'generic' && input.optional && !input.hasHandle;

interface NodeBodyProps {
    id: string;
    inputData: InputData;
    inputSize?: InputSize;
    isLocked?: boolean;
    schema: NodeSchema;
    animated?: boolean;
}

export const NodeBody = memo(
    ({ schema, id, inputData, inputSize, isLocked, animated = false }: NodeBodyProps) => {
        const { inputs, outputs, schemaId } = schema;

        const autoInput = inputs.length === 1 && isAutoInput(inputs[0]);

        return (
            <>
                {!autoInput && inputs.length > 0 && <Box py={1} />}
                {!autoInput && (
                    <Center w="full">
                        <Box
                            bg="var(--gray-700)"
                            // borderRadius="lg"
                            overflow="hidden"
                            // w="calc(100% - 0.5rem)"
                            w="full"
                        >
                            <NodeInputs
                                id={id}
                                inputData={inputData}
                                inputSize={inputSize}
                                isLocked={isLocked}
                                schema={schema}
                            />
                        </Box>
                    </Center>
                )}

                {!autoInput && outputs.length > 0 && <Box py={1} />}
                <Center w="full">
                    <Box
                        bg="var(--gray-700)"
                        // borderRadius="lg"
                        overflow="hidden"
                        // w="calc(100% - 0.5rem)"
                        w="full"
                    >
                        <NodeOutputs
                            animated={animated}
                            id={id}
                            outputs={outputs}
                            schemaId={schemaId}
                        />
                    </Box>
                </Center>
                {/* {outputs.length > 0 && <Box py={1} />} */}
            </>
        );
    }
);
