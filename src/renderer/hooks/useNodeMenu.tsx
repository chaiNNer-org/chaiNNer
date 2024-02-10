import {
    CloseIcon,
    CopyIcon,
    DeleteIcon,
    LockIcon,
    RepeatIcon,
    UnlockIcon,
} from '@chakra-ui/icons';
import { MenuDivider, MenuItem, MenuList } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { BsFillJournalBookmarkFill } from 'react-icons/bs';
import { MdPlayArrow, MdPlayDisabled } from 'react-icons/md';
import { useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { EdgeData, NodeData } from '../../common/common-types';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { NodeDocumentationContext } from '../contexts/NodeDocumentationContext';
import { copyToClipboard } from '../helpers/copyAndPaste';
import { UseContextMenu, useContextMenu } from './useContextMenu';
import { UseDisabled } from './useDisabled';

export interface UseNodeMenuOptions {
    canLock?: boolean;
    reload?: () => void;
}

export const useNodeMenu = (
    data: NodeData,
    useDisabled: UseDisabled,
    { canLock = true, reload }: UseNodeMenuOptions = {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    memoBust?: any
): UseContextMenu => {
    const { openNodeDocumentation } = useContext(NodeDocumentationContext);
    const { id, isLocked = false, schemaId } = data;

    const { removeNodesById, resetInputs, resetConnections, duplicateNodes, toggleNodeLock } =
        useContext(GlobalContext);
    const { isDirectlyDisabled, canDisable, toggleDirectlyDisabled } = useDisabled;

    const { getNode, getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

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
                    const node = getNode(id);
                    if (node && !node.selected) {
                        const nodeCopy = { ...node, selected: true };
                        copyToClipboard([nodeCopy], []);
                    } else {
                        copyToClipboard(getNodes(), getEdges());
                    }
                }}
            >
                Copy
            </MenuItem>
            <MenuItem
                icon={<CopyIcon />}
                onClick={() => {
                    duplicateNodes([id]);
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
                            resetInputs([id]);
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
                            resetConnections([id]);
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
                            resetInputs([id]);
                            resetConnections([id]);
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
            {canDisable && (
                <MenuItem
                    icon={isDirectlyDisabled ? <MdPlayArrow /> : <MdPlayDisabled />}
                    onClick={toggleDirectlyDisabled}
                >
                    {isDirectlyDisabled ? 'Enable' : 'Disable'}
                </MenuItem>
            )}

            {canLock && (
                <MenuItem
                    icon={isLocked ? <UnlockIcon /> : <LockIcon />}
                    onClick={() => {
                        toggleNodeLock(id);
                    }}
                >
                    {isLocked ? 'Unlock' : 'Lock'}
                </MenuItem>
            )}

            {reload && (
                <MenuItem
                    icon={<RepeatIcon />}
                    onClick={reload}
                >
                    Refresh Preview
                </MenuItem>
            )}

            <MenuItem
                icon={<DeleteIcon />}
                onClick={() => {
                    removeNodesById([id]);
                }}
            >
                Delete
            </MenuItem>
            <MenuDivider />
            <MenuItem
                icon={<BsFillJournalBookmarkFill />}
                onClick={() => {
                    openNodeDocumentation(schemaId);
                }}
            >
                Open Documentation
            </MenuItem>
        </MenuList>
    ));
};
