import {
    CloseIcon,
    CopyIcon,
    DeleteIcon,
    LockIcon,
    RepeatIcon,
    UnlockIcon,
} from '@chakra-ui/icons';
import { MenuItem, MenuList } from '@chakra-ui/react';
import { BsFillJournalBookmarkFill, BsLayerForward } from 'react-icons/bs';
import { MdPlayArrow, MdPlayDisabled } from 'react-icons/md';
import { useContext } from 'use-context-selector';
import { NodeData } from '../../common/common-types';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { NodeDocumentationContext } from '../contexts/NodeDocumentationContext';
import { UseContextMenu, useContextMenu } from './useContextMenu';
import { UseDisabled } from './useDisabled';

export interface UseNodeMenuOptions {
    canLock?: boolean;
    reload?: () => void;
}

export const useNodeMenu = (
    data: NodeData,
    useDisabled: UseDisabled,
    { canLock = true, reload }: UseNodeMenuOptions = {}
): UseContextMenu => {
    const { openNodeDocumentation } = useContext(NodeDocumentationContext);
    const { id, isLocked = false, parentNode, schemaId } = data;

    const { removeNodesById, clearNodes, duplicateNodes, toggleNodeLock, releaseNodeFromParent } =
        useContext(GlobalContext);
    const { isDirectlyDisabled, canDisable, toggleDirectlyDisabled } = useDisabled;

    return useContextMenu(() => (
        <MenuList className="nodrag">
            <MenuItem
                icon={<CopyIcon />}
                onClick={() => {
                    duplicateNodes([id]);
                }}
            >
                Duplicate
            </MenuItem>
            <MenuItem
                icon={<CloseIcon />}
                onClick={() => {
                    clearNodes([id]);
                }}
            >
                Clear
            </MenuItem>
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
            {parentNode && (
                <MenuItem
                    icon={<BsLayerForward />}
                    onClick={() => {
                        releaseNodeFromParent(id);
                    }}
                >
                    Release
                </MenuItem>
            )}
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
