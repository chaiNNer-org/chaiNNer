import { ChevronRightIcon, CloseIcon, CopyIcon, DeleteIcon } from '@chakra-ui/icons';
import { HStack, MenuDivider, MenuItem, MenuList, Spacer, Text } from '@chakra-ui/react';
import { useRef } from 'react';
import { Node, useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { EdgeData, NodeData } from '../../common/common-types';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { copyToClipboard } from '../helpers/copyAndPaste';
import { UseContextMenu, useContextMenu } from './useContextMenu';

import './useNodeMenu.scss';

export const useNodesMenu = (nodes: Node<NodeData>[]): UseContextMenu => {
    const { removeNodesById, resetInputs, resetConnections, duplicateNodes } =
        useContext(GlobalContext);

    const nodeIds = nodes.map((n) => n.id);

    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    const resetMenuParentRef = useRef<HTMLButtonElement>(null);

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
                as="a"
                className="useNodeMenu-container"
                closeOnSelect={false}
                icon={<CloseIcon />}
                ref={resetMenuParentRef}
            >
                <HStack>
                    <Text>Reset Nodes</Text>
                    <Spacer />
                    <ChevronRightIcon />
                </HStack>
            </MenuItem>
            <div className="useNodeMenu-child">
                <MenuList
                    className="nodrag"
                    left={resetMenuParentRef.current?.offsetWidth || 0}
                    position="absolute"
                    top={(resetMenuParentRef.current?.offsetHeight || 0) - 12}
                >
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
                </MenuList>
            </div>
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
