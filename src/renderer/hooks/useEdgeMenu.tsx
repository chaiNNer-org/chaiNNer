import { DeleteIcon } from '@chakra-ui/icons';
import { MenuItem, MenuList } from '@chakra-ui/react';
import { useContext } from 'use-context-selector';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { UseContextMenu, useContextMenu } from './useContextMenu';

export const useEdgeMenu = (id: string): UseContextMenu => {
    const { removeEdgeById } = useContext(GlobalContext);

    return useContextMenu(() => (
        <MenuList className="nodrag">
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
