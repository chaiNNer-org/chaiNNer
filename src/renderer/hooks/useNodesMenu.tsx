import { CloseIcon, CopyIcon, DeleteIcon } from '@chakra-ui/icons';
import { MenuDivider, MenuItem, MenuList } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { Node, useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { EdgeData, NodeData } from '../../common/common-types';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { copyToClipboard } from '../helpers/copyAndPaste';
import { UseContextMenu, useContextMenu } from './useContextMenu';

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
export const useNodesMenu = (nodes: Node<NodeData>[], memoBust?: any): UseContextMenu => {
    const { removeNodesById, resetInputs, resetConnections, duplicateNodes } =
        useContext(GlobalContext);

    const nodeIds = nodes.map((n) => n.id);

    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    const resetMenuParentRef = useRef<HTMLButtonElement>(null);
    const [showResetSubMenu, setShowResetSubMenu] = useState(false);

    useEffect(() => {
        setShowResetSubMenu(false);
    }, []);

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
                ref={resetMenuParentRef}
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowResetSubMenu(true);
                }}
                onContextMenu={() => {
                    setShowResetSubMenu(false);
                }}
                onMouseEnter={() => {
                    setShowResetSubMenu(true);
                }}
                onMouseLeave={() => {
                    setShowResetSubMenu(false);
                }}
                onMouseOver={() => {
                    setShowResetSubMenu(true);
                }}
            >
                Reset Node
            </MenuItem>
            {showResetSubMenu && (
                <MenuList
                    className="nodrag"
                    left={resetMenuParentRef.current?.offsetWidth || 0}
                    position="absolute"
                    top={(resetMenuParentRef.current?.offsetHeight || 0) - 12}
                    onContextMenu={() => {
                        setShowResetSubMenu(false);
                    }}
                    onMouseEnter={() => {
                        setShowResetSubMenu(true);
                    }}
                    onMouseLeave={() => {
                        setShowResetSubMenu(false);
                    }}
                    onMouseOver={() => {
                        setShowResetSubMenu(true);
                    }}
                >
                    <MenuItem
                        icon={<CloseIcon />}
                        onClick={() => {
                            resetInputs(nodeIds);
                            setShowResetSubMenu(false);
                        }}
                        onMouseLeave={() => {
                            setShowResetSubMenu(false);
                        }}
                    >
                        Reset Inputs
                    </MenuItem>
                    <MenuItem
                        icon={<CloseIcon />}
                        onClick={() => {
                            resetConnections(nodeIds);
                            setShowResetSubMenu(false);
                        }}
                        onMouseLeave={() => {
                            setShowResetSubMenu(false);
                        }}
                    >
                        Reset Connections
                    </MenuItem>
                    <MenuItem
                        icon={<CloseIcon />}
                        onClick={() => {
                            resetInputs(nodeIds);
                            resetConnections(nodeIds);
                            setShowResetSubMenu(false);
                        }}
                        onMouseLeave={() => {
                            setShowResetSubMenu(false);
                        }}
                    >
                        Reset All
                    </MenuItem>
                </MenuList>
            )}
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
