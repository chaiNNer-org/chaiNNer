import { NeverType } from '@chainner/navi';
import { DeleteIcon } from '@chakra-ui/icons';
import { Box, Flex, MenuItem, MenuList } from '@chakra-ui/react';
import { memo, useEffect, useMemo, useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { EdgeData, NodeData, OutputId } from '../../../common/common-types';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { getTypeAccentColors } from '../../helpers/accentColors';
import { UseContextMenu, useContextMenu } from '../../hooks/useContextMenu';

const useBreakPointMenu = (id: string): UseContextMenu => {
    const { removeNodesById, removeEdgeBreakpoint } = useContext(GlobalContext);

    return useContextMenu(() => (
        <MenuList className="nodrag">
            <MenuItem
                icon={<DeleteIcon />}
                onClick={() => {
                    removeEdgeBreakpoint(id);
                }}
            >
                Remove Breakpoint
            </MenuItem>
            <MenuItem
                icon={<DeleteIcon />}
                onClick={() => {
                    removeNodesById([id]);
                }}
            >
                Remove Edge
            </MenuItem>
        </MenuList>
    ));
};

export const BreakPoint = memo(({ id }: NodeProps) => {
    return (
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        <BreakPointInner id={id} />
    );
});

export interface NodeProps {
    id: string;
}

const BreakPointInner = memo(({ id }: NodeProps) => {
    const { getEdges, getNode } = useReactFlow<NodeData, EdgeData>();
    const { edgeChanges } = useContext(GlobalVolatileContext);
    const { removeNodesById } = useContext(GlobalContext);
    const { functionDefinitions } = useContext(BackendContext);

    const menu = useBreakPointMenu(id);

    const [leftEdge, rightEdge] = useMemo(() => {
        // I'm making an assumption here that a single filter is faster than two finds
        // The subsequent two finds will just be over the filtered array, and therefore fast
        const edges = getEdges().filter((edge) => edge.source === id || edge.target === id);
        const left = edges.find((edge) => edge.source === id);
        const right = edges.find((edge) => edge.target === id);
        return [left, right];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getEdges, id, edgeChanges]);

    useEffect(() => {
        // If at any time the left or right edge is missing, remove the node
        // This is to prevent orphaned breakpoints, and to delete the entire visual edge
        if (!leftEdge || !rightEdge) {
            removeNodesById([id]);
        }
    }, [id, leftEdge, removeNodesById, rightEdge]);

    const parentNode = useMemo(() => {
        if (!leftEdge) return;
        return getNode(leftEdge.source)!;
    }, [leftEdge, getNode]);

    const definitionType = useMemo(
        () =>
            parentNode
                ? functionDefinitions
                      .get(parentNode.data.schemaId)
                      ?.outputDefaults.get(0 as OutputId) ?? NeverType.instance
                : NeverType.instance,
        [functionDefinitions, parentNode]
    );

    const typeState = useContextSelector(GlobalVolatileContext, (c) => c.typeState);
    const type = useMemo(
        () =>
            leftEdge
                ? typeState.functions.get(leftEdge.source)?.outputs.get(0 as OutputId)
                : undefined,
        [leftEdge, typeState]
    );

    const [accentColor] = useMemo(
        () => getTypeAccentColors(type || definitionType),
        [type, definitionType]
    );

    const [isHovered, setIsHovered] = useState(false);
    // Prevent hovered state from getting stuck
    const hoverTimeout = useDebouncedCallback(() => {
        setIsHovered(false);
    }, 7500);

    return (
        <>
            <Box
                _hover={{
                    height: '16px',
                    width: '16px',
                    margin: '-2px',
                }}
                backgroundColor={accentColor}
                borderRadius="100%"
                height={isHovered ? '16px' : '12px'}
                margin={isHovered ? '-2px' : '0'}
                position="relative"
                transition="all 0.2s ease-in-out"
                width={isHovered ? '16px' : '12px'}
                onContextMenu={menu.onContextMenu}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onMouseOver={() => hoverTimeout()}
            >
                <Flex
                    align="center"
                    height="full"
                    position="relative"
                    verticalAlign="middle"
                    width="full"
                >
                    <Flex
                        align="center"
                        height="1px"
                        margin="auto"
                        position="relative"
                        verticalAlign="middle"
                        width="1px"
                    >
                        <Handle
                            className="absolute-fifty"
                            id={`${id}-0`}
                            isConnectable={false}
                            position={Position.Left}
                            style={{
                                margin: 'auto',
                                width: '1px',
                                height: '1px',
                                border: 'none',
                                opacity: 0,
                            }}
                            type="target"
                        />
                        <Handle
                            className="absolute-fifty"
                            id={`${id}-0`}
                            isConnectable={false}
                            position={Position.Right}
                            style={{
                                margin: 'auto',
                                width: '1px',
                                height: '1px',
                                border: 'none',
                                opacity: 0,
                            }}
                            type="source"
                        />
                    </Flex>
                </Flex>
            </Box>
            <Box
                backgroundColor="red"
                borderRadius="100%"
                height="26px"
                left="50%"
                opacity={0}
                position="absolute"
                top="50%"
                transform="translate(-50%, -50%)"
                transition="all 0.2s ease-in-out"
                width="26px"
                onContextMenu={menu.onContextMenu}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onMouseOver={() => hoverTimeout()}
            />
        </>
    );
});
