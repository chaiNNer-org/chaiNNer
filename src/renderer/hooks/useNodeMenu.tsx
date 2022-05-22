import { CloseIcon, CopyIcon, DeleteIcon } from '@chakra-ui/icons';
import { MenuItem, MenuList } from '@chakra-ui/react';
import { useContext } from 'use-context-selector';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { UseContextMenu, useContextMenu } from './useContextMenu';

export const useNodeMenu = (id: string): UseContextMenu => {
    const { removeNodeById, clearNode, duplicateNode } = useContext(GlobalContext);

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
                    icon={<DeleteIcon />}
                    onClick={() => {
                        removeNodeById(id);
                    }}
                >
                    Delete
                </MenuItem>
            </MenuList>
        ),
        [id, duplicateNode, clearNode, removeNodeById]
    );
};
