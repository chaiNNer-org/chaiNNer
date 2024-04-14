import { Box } from '@chakra-ui/react';
import { memo } from 'react';

import { isAutoInput } from '../../../common/util';
import { CollapsedNode } from '../../contexts/CollapsedNodeContext';
import { NodeState } from '../../helpers/nodeState';
import { NodeInputs } from './NodeInputs';
import { NodeOutputs } from './NodeOutputs';

interface NodeBodyProps {
    nodeState: NodeState;
    isCollapsed: boolean;
    animated: boolean;
}

export const NodeBody = memo(({ nodeState, isCollapsed, animated }: NodeBodyProps) => {
    const { inputs, outputs } = nodeState.schema;

    const autoInput = inputs.length === 1 && isAutoInput(inputs[0]);
    const anyVisibleOutputs = outputs.some((output) => {
        return !inputs.some((input) => input.fused?.outputId === output.id);
    });

    if (isCollapsed) {
        return (
            <CollapsedNode>
                <NodeInputs nodeState={nodeState} />
                <NodeOutputs
                    animated={animated}
                    nodeState={nodeState}
                />
            </CollapsedNode>
        );
    }

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

            {anyVisibleOutputs && <Box py={1} />}
            <Box
                bg="var(--bg-700)"
                w="full"
            >
                <NodeOutputs
                    animated={animated}
                    nodeState={nodeState}
                />
            </Box>
        </>
    );
});
