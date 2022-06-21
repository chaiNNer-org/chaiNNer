import { Center, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { Input, InputData, Output } from '../../../common/common-types';
import NodeInputs from './NodeInputs';
import NodeOutputs from './NodeOutputs';

interface NodeBodyProps {
    accentColor: string;
    id: string;
    inputData: InputData;
    isLocked?: boolean;
    inputs: readonly Input[];
    outputs: readonly Output[];
    schemaId: string;
}

const NodeBody = memo(
    ({ accentColor, inputs, outputs, id, inputData, isLocked, schemaId }: NodeBodyProps) => (
        <>
            {inputs.length && (
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
                accentColor={accentColor}
                id={id}
                inputData={inputData}
                inputs={inputs}
                isLocked={isLocked}
                schemaId={schemaId}
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
                accentColor={accentColor}
                id={id}
                outputs={outputs}
            />
        </>
    )
);

export default NodeBody;
