import { NeverType } from '@chainner/navi';
import { DeleteIcon } from '@chakra-ui/icons';
import { Box, Center, MenuItem, MenuList } from '@chakra-ui/react';
import { memo, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { EdgeData, NodeData, OutputId } from '../../../common/common-types';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { UseContextMenu, useContextMenu } from '../../hooks/useContextMenu';
import { useTypeColor } from '../../hooks/useTypeColor';

const useBreakPointMenu = (id: string): UseContextMenu => {
    const { removeNodesById, removeEdgeBreakpoint } = useContext(GlobalContext);
    const { t } = useTranslation();

    return useContextMenu(() => (
        <MenuList className="nodrag">
            <MenuItem
                icon={<DeleteIcon />}
                onClick={() => {
                    removeEdgeBreakpoint(id);
                }}
            >
                {t('breakpoint.removeBreakpoint', 'Remove Breakpoint')}
            </MenuItem>
            <MenuItem
                icon={<DeleteIcon />}
                onClick={() => {
                    removeNodesById([id]);
                }}
            >
                {t('breakpoint.removeEdge', 'Remove Edge')}
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
    const { removeNodesById, removeEdgeBreakpoint } = useContext(GlobalContext);
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

    const [accentColor] = useTypeColor(type || definitionType);

    return (
        <Box
            data-group
            height="1px"
            position="relative"
            width="1px"
            onContextMenu={menu.onContextMenu}
            onDoubleClick={() => removeEdgeBreakpoint(id)}
        >
            <Center
                _groupHover={{
                    height: '16px',
                    width: '16px',
                }}
                backgroundColor={accentColor}
                borderRadius="100%"
                height="12px"
                position="absolute"
                transform="translate(-50%, -50%)"
                transition="all 0.2s ease-in-out"
                width="12px"
            >
                <Box
                    height="1px"
                    position="relative"
                    width="1px"
                >
                    <Handle
                        className="absolute-fifty"
                        id={`${id}-0`}
                        isConnectable={false}
                        position={Position.Left}
                        style={{
                            margin: 'auto',
                            width: '12px',
                            height: '12px',
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
                            width: '12px',
                            height: '12px',
                            border: 'none',
                            opacity: 0,
                        }}
                        type="source"
                    />
                </Box>
            </Center>
            {/* This is a ghost circle meant to help increase the hoverable diameter without visually making it look too large */}
            <Box
                backgroundColor="red"
                borderRadius="100%"
                height="26px"
                opacity={0}
                position="absolute"
                transform="translate(-50%, -50%)"
                transition="all 0.2s ease-in-out"
                width="26px"
            />
        </Box>
    );
});
