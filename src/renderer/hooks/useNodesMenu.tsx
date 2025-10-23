import { ChevronRightIcon, CloseIcon, CopyIcon, DeleteIcon } from '@chakra-ui/icons';
import { HStack, MenuDivider, MenuItem, MenuList, Spacer, Text } from '@chakra-ui/react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MdPlayArrow, MdPlayDisabled } from 'react-icons/md';
import { Node, useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { EdgeData, NodeData } from '../../common/common-types';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { copyToClipboard } from '../helpers/copyAndPaste';
import { UseContextMenu, useContextMenu } from './useContextMenu';

import './useNodeMenu.scss';

export const useNodesMenu = (nodes: Node<NodeData>[]): UseContextMenu => {
    const { t } = useTranslation();
    const { removeNodesById, resetInputs, resetConnections, duplicateNodes, setNodeDisabled } =
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
                {t('nodesMenu.copy', 'Copy')}
            </MenuItem>
            <MenuItem
                icon={<CopyIcon />}
                onClick={() => {
                    duplicateNodes(nodeIds);
                }}
            >
                {t('nodesMenu.duplicate', 'Duplicate')}
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
                    <Text>{t('nodesMenu.resetNodes', 'Reset Nodes')}</Text>
                    <Spacer />
                    <ChevronRightIcon />
                </HStack>
            </MenuItem>
            <div className="useNodeMenu-child">
                <MenuList
                    className="nodrag"
                    left={resetMenuParentRef.current?.offsetWidth || 0}
                    marginTop="-55px"
                    position="absolute"
                    top={resetMenuParentRef.current?.offsetHeight || 0}
                >
                    <MenuItem
                        icon={<CloseIcon />}
                        onClick={() => {
                            resetInputs(nodeIds);
                        }}
                    >
                        {t('nodesMenu.resetInputs', 'Reset Inputs')}
                    </MenuItem>
                    <MenuItem
                        icon={<CloseIcon />}
                        onClick={() => {
                            resetConnections(nodeIds);
                        }}
                    >
                        {t('nodesMenu.resetConnections', 'Reset Connections')}
                    </MenuItem>
                    <MenuItem
                        icon={<CloseIcon />}
                        onClick={() => {
                            resetInputs(nodeIds);
                            resetConnections(nodeIds);
                        }}
                    >
                        {t('nodesMenu.resetAll', 'Reset All')}
                    </MenuItem>
                </MenuList>
            </div>
            <MenuDivider />
            <MenuItem
                icon={<MdPlayArrow />}
                isDisabled={nodes.every((n) => !n.data.isDisabled)}
                onClick={() => {
                    for (const id of nodeIds) {
                        setNodeDisabled(id, false);
                    }
                }}
            >
                {t('nodesMenu.enableAll', 'Enable All')}
            </MenuItem>
            <MenuItem
                icon={<MdPlayDisabled />}
                isDisabled={nodes.every((n) => n.data.isDisabled)}
                onClick={() => {
                    for (const id of nodeIds) {
                        setNodeDisabled(id, true);
                    }
                }}
            >
                {t('nodesMenu.disableAll', 'Disable All')}
            </MenuItem>
            <MenuDivider />
            <MenuItem
                icon={<DeleteIcon />}
                onClick={() => {
                    removeNodesById(nodeIds);
                }}
            >
                {t('nodesMenu.delete', 'Delete')}
            </MenuItem>
        </MenuList>
    ));
};
