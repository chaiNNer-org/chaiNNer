import { Center, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { Input, InputData, Output } from '../../common-types';
import NodeInputs from './NodeInputs';
import NodeOutputs from './NodeOutputs';
// useContext, useEffect, useMemo,

interface NodeBodyProps {
    accentColor: string;
    id: string;
    inputData: InputData;
    isLocked?: boolean;
    inputs: readonly Input[];
    outputs: readonly Output[];
    schemaId: string;
}

const NodeBody = ({
    accentColor,
    inputs,
    outputs,
    id,
    inputData,
    isLocked,
    schemaId,
}: NodeBodyProps) => (
    <>
        {inputs.length && (
            <Center>
                <Text
                    fontSize="xs"
                    m={0}
                    mb={-1}
                    mt={-1}
                    p={0}
                    pb={-1}
                    pt={-1}
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
                    pb={-1}
                    pt={-1}
                >
                    OUTPUTS
                </Text>
            </Center>
        )}
        <NodeOutputs
            id={id}
            outputs={outputs}
        />
    </>
);

export default memo(NodeBody);
