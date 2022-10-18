import { Center, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { InputData, InputSize, NodeSchema } from '../../../common/common-types';
import { NodeInputs } from './NodeInputs';
import { NodeOutputs } from './NodeOutputs';

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

        return (
            <>
                {inputs.length > 0 && (
                    <Center>
                        <Text
                            fontSize="xs"
                            m={0}
                            mb={-1}
                            mt={-1}
                            p={0}
                        >
                            INPUTS
                        </Text>
                    </Center>
                )}
                <NodeInputs
                    id={id}
                    inputData={inputData}
                    inputSize={inputSize}
                    isLocked={isLocked}
                    schema={schema}
                />

                {outputs.length > 0 && (
                    <Center>
                        <Text
                            fontSize="xs"
                            m={0}
                            mb={-1}
                            mt={-1}
                            p={0}
                        >
                            OUTPUTS
                        </Text>
                    </Center>
                )}
                <NodeOutputs
                    animated={animated}
                    id={id}
                    outputs={outputs}
                    schemaId={schemaId}
                />
            </>
        );
    }
);
