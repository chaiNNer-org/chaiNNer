import { CloseIcon, CopyIcon, DeleteIcon } from '@chakra-ui/icons';
import { MenuItem, MenuList } from '@chakra-ui/react';
import { Node } from 'reactflow';
import { useContext } from 'use-context-selector';
import { NodeData } from '../../common/common-types';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { UseContextMenu, useContextMenu } from './useContextMenu';

export const useNodesMenu = (nodes: Node<NodeData>[]): UseContextMenu => {
    const { removeNodesById, clearNodes, duplicateNodes } = useContext(GlobalContext);

    const nodeIds = nodes.map((n) => n.id);

    return useContextMenu(() => (
        <MenuList className="nodrag">
            <MenuItem
                icon={<CopyIcon />}
                onClick={() => {
                    duplicateNodes(nodeIds);
                }}
            >
                Duplicate
            </MenuItem>
            <MenuItem
                icon={<CloseIcon />}
                onClick={() => {
                    clearNodes(nodeIds);
                }}
            >
                Clear
            </MenuItem>
            <MenuItem
                icon={<DeleteIcon />}
                onClick={() => {
                    removeNodesById(nodeIds);
                }}
            >
                Delete
            </MenuItem>
        </MenuList>
    ));
};
