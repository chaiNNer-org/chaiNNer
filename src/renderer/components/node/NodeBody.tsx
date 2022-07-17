import { Center, Text } from '@chakra-ui/react';
import { memo } from 'react';
import {
    Input,
    InputData,
    InputSize,
    Output,
    OutputData,
    SchemaId,
} from '../../../common/common-types';
import { NodeInputs } from './NodeInputs';
import { NodeOutputs } from './NodeOutputs';

interface NodeBodyProps {
    id: string;
    inputData: InputData;
    inputSize?: InputSize;
    isLocked?: boolean;
    inputs: readonly Input[];
    outputs: readonly Output[];
    accentColor: string;
    schemaId: SchemaId;
    outputData?: OutputData;
}

export const NodeBody = memo(
    ({
        inputs,
        outputs,
        id,
        inputData,
        inputSize,
        isLocked,
        schemaId,
        accentColor,
        outputData,
    }: NodeBodyProps) => {
        return (
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
                    inputSize={inputSize}
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
                    id={id}
                    outputData={outputData}
                    outputs={outputs}
                    schemaId={schemaId}
                />
            </>
        );
    }
);
