import { Box, Flex } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { NodeData } from '../../../common/common-types';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';

export const BreakPoint = memo(({ data, selected, id }: NodeProps) => {
    return (
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        <BreakPointInner
            data={data}
            id={id}
            selected={selected}
        />
    );
});

export interface NodeProps {
    data: NodeData;
    selected: boolean;
    id: string;
}

const BreakPointInner = memo(({ data, selected, id }: NodeProps) => {
    const { getEdges } = useReactFlow();
    const { edgeChanges } = useContext(GlobalVolatileContext);
    const { removeNodesById } = useContext(GlobalContext);

    useEffect(() => {
        const edges = getEdges().filter((edge) => edge.source === id || edge.target === id);
        if (edges.length <= 1) {
            removeNodesById([id]);
        }
    }, [getEdges, id, edgeChanges, removeNodesById]);

    return (
        <Box
            backgroundColor="red"
            borderRadius="100%"
            height={2}
            position="relative"
            width={2}
        >
            <Flex
                align="center"
                height="full"
                verticalAlign="middle"
                width="full"
            >
                <Handle
                    id={`${id}-0`}
                    isConnectable={false}
                    position={Position.Left}
                    style={{
                        margin: 'auto',
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        position: 'absolute',
                        opacity: 0,
                    }}
                    type="target"
                />
                <Handle
                    id={`${id}-0`}
                    isConnectable={false}
                    position={Position.Right}
                    style={{
                        margin: 'auto',
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        position: 'absolute',
                        opacity: 0,
                    }}
                    type="source"
                />
            </Flex>
        </Box>
    );
});
