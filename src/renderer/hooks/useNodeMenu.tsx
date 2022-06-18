import { CloseIcon, CopyIcon, DeleteIcon, LockIcon, UnlockIcon } from '@chakra-ui/icons';
import { MenuItem, MenuList } from '@chakra-ui/react';
import { MdPlayArrow, MdPlayDisabled } from 'react-icons/md';
import { useContext } from 'use-context-selector';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { UseContextMenu, useContextMenu } from './useContextMenu';

export const useNodeMenu = (
    id: string,
    isLocked: boolean | undefined,
    isDisabled: boolean
): UseContextMenu => {
    const { removeNodeById, clearNode, duplicateNode, toggleNodeLock, setNodeDisabled } =
        useContext(GlobalContext);

    return useContextMenu(
        () => (
            <MenuList className="nodrag">
                <MenuItem
                    icon={<CopyIcon />}
                    onClick={() => {
                        duplicateNode(id);
                    }}
                >
                    Duplicate
                </MenuItem>
                <MenuItem
                    icon={<CloseIcon />}
                    onClick={() => {
                        clearNode(id);
                    }}
                >
                    Clear
                </MenuItem>
                <MenuItem
                    icon={isDisabled ? <MdPlayArrow /> : <MdPlayDisabled />}
                    onClick={() => {
                        setNodeDisabled(id, !isDisabled);
                    }}
                >
                    {isDisabled ? 'Enable' : 'Disable'}
                </MenuItem>
                {isLocked !== undefined ? (
                    <MenuItem
                        icon={isLocked ? <UnlockIcon /> : <LockIcon />}
                        onClick={() => {
                            toggleNodeLock(id);
                        }}
                    >
                        {isLocked ? 'Unlock' : 'Lock'}
                    </MenuItem>
                ) : null}
                <MenuItem
                    icon={<DeleteIcon />}
                    onClick={() => {
                        removeNodeById(id);
                    }}
                >
                    Delete
                </MenuItem>
            </MenuList>
        ),
        [id, duplicateNode, clearNode, removeNodeById, isLocked, isDisabled]
    );
};
