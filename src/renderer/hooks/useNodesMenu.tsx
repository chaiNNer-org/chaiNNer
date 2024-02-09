import { CloseIcon, CopyIcon, DeleteIcon } from '@chakra-ui/icons';
import { MenuDivider, MenuItem, MenuList } from '@chakra-ui/react';
import { Node, useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { EdgeData, NodeData } from '../../common/common-types';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { copyToClipboard } from '../helpers/copyAndPaste';
import { UseContextMenu, useContextMenu } from './useContextMenu';

export const useNodesMenu = (nodes: Node<NodeData>[]): UseContextMenu => {
    const { removeNodesById, resetInputs, resetConnections, duplicateNodes } =
        useContext(GlobalContext);

    const nodeIds = nodes.map((n) => n.id);

    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    return useContextMenu(() => (
        <MenuList className="nodrag">
            <MenuItem
                icon={<CopyIcon />}
                onClick={() => {
                    copyToClipboard(getNodes(), getEdges());
                }}
            >
                Copy
            </MenuItem>
            <MenuItem
                icon={<CopyIcon />}
                onClick={() => {
                    duplicateNodes(nodeIds);
                }}
            >
                Duplicate
            </MenuItem>
            <MenuDivider />
            <MenuItem
                icon={<CloseIcon />}
                onClick={() => {
                    resetInputs(nodeIds);
                }}
            >
                Reset Inputs
            </MenuItem>
            <MenuItem
                icon={<CloseIcon />}
                onClick={() => {
                    resetConnections(nodeIds);
                }}
            >
                Reset Connections
            </MenuItem>
            <MenuItem
                icon={<CloseIcon />}
                onClick={() => {
                    resetInputs(nodeIds);
                    resetConnections(nodeIds);
                }}
            >
                Reset All
            </MenuItem>
            <MenuDivider />
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
