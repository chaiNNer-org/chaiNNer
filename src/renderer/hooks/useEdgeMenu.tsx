import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { MenuItem, MenuList } from '@chakra-ui/react';
import { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { UseContextMenu, useContextMenu } from './useContextMenu';

export const useEdgeMenu = (id: string): UseContextMenu => {
    const { t } = useTranslation();
    const { removeEdgeById, addEdgeBreakpoint } = useContext(GlobalContext);
    const { screenToFlowPosition } = useReactFlow();

    return useContextMenu((originalEvent: MouseEvent | null) => {
        return (
            <MenuList className="nodrag">
                <MenuItem
                    icon={<AddIcon />}
                    onClick={() => {
                        const adjustedPosition = screenToFlowPosition({
                            x: originalEvent?.clientX || 0,
                            y: originalEvent?.clientY || 0,
                        });
                        addEdgeBreakpoint(id, adjustedPosition);
                    }}
                >
                    {t('edgeMenu.addBreakpoint', 'Add Breakpoint')}
                </MenuItem>
                <MenuItem
                    icon={<DeleteIcon />}
                    onClick={() => {
                        removeEdgeById(id);
                    }}
                >
                    {t('edgeMenu.delete', 'Delete')}
                </MenuItem>
            </MenuList>
        );
    });
};
