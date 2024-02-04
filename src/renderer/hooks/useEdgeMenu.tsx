import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { MenuItem, MenuList } from '@chakra-ui/react';
import { useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { UseContextMenu, useContextMenu } from './useContextMenu';

export const useEdgeMenu = (id: string): UseContextMenu => {
    const { removeEdgeById, addEdgeBreakpoint } = useContext(GlobalContext);
    const { screenToFlowPosition } = useReactFlow();

    return useContextMenu(() => (
        <MenuList className="nodrag">
            <MenuItem
                icon={<AddIcon />}
                onClick={(e) => {
                    const adjustedPosition = screenToFlowPosition({ x: e.pageX, y: e.pageY });
                    addEdgeBreakpoint(id, [adjustedPosition.x, adjustedPosition.y]);
                }}
            >
                Add Breakpoint
            </MenuItem>
            <MenuItem
                icon={<DeleteIcon />}
                onClick={() => {
                    removeEdgeById(id);
                }}
            >
                Delete
            </MenuItem>
        </MenuList>
    ));
};
