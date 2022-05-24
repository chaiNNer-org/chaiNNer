import { CloseIcon, CopyIcon, DeleteIcon, LockIcon, UnlockIcon } from '@chakra-ui/icons';
import { MenuItem, MenuList } from '@chakra-ui/react';
import { useContext } from 'use-context-selector';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { UseContextMenu, useContextMenu } from './useContextMenu';

export const useNodeMenu = (id: string, isLocked: boolean | undefined): UseContextMenu => {
    const { removeNodeById, clearNode, duplicateNode, toggleNodeLock } = useContext(GlobalContext);

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
        [id, duplicateNode, clearNode, removeNodeById, isLocked]
    );
};
