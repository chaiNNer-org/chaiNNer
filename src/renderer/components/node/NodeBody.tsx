import { Box } from '@chakra-ui/react';
import { memo } from 'react';

import { isAutoInput } from '../../../common/util';
import { NodeState } from '../../helpers/nodeState';
import { NodeInputs } from './NodeInputs';
import { NodeOutputs } from './NodeOutputs';

interface NodeBodyProps {
    nodeState: NodeState;
    animated?: boolean;
}

export const NodeBody = memo(({ nodeState, animated = false }: NodeBodyProps) => {
    const { inputs, outputs } = nodeState.schema;

    const autoInput = inputs.length === 1 && isAutoInput(inputs[0]);

    return (
        <>
            {!autoInput && inputs.length > 0 && <Box py={1} />}
            {!autoInput && (
                <Box
                    bg="var(--bg-700)"
                    w="full"
                >
                    <NodeInputs nodeState={nodeState} />
                </Box>
            )}

            {outputs.length > 0 && <Box py={1} />}
            <Box
                bg="var(--bg-700)"
                w="full"
            >
                <NodeOutputs
                    animated={animated}
                    id={nodeState.id}
                    outputs={outputs}
                    schemaId={nodeState.schemaId}
                />
            </Box>
        </>
    );
});
