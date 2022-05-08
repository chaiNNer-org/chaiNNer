import { Center, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { Input, Output } from '../../common-types';
import NodeInputs from './NodeInputs';
import NodeOutputs from './NodeOutputs';
// useContext, useEffect, useMemo,

interface NodeBodyProps {
    accentColor: string;
    id: string;
    isLocked?: boolean;
    category: string;
    nodeType: string;
    inputs: readonly Input[];
    outputs: readonly Output[];
    identifier: string;
}

const NodeBody = ({
    accentColor,
    inputs,
    outputs,
    id,
    isLocked,
    category,
    nodeType,
    identifier,
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
            category={category}
            id={id}
            identifier={identifier}
            inputs={inputs}
            isLocked={isLocked}
            nodeType={nodeType}
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
