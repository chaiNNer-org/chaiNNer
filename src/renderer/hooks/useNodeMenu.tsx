import {
    ChevronRightIcon,
    CloseIcon,
    CopyIcon,
    DeleteIcon,
    LockIcon,
    RepeatIcon,
    UnlockIcon,
} from '@chakra-ui/icons';
import { HStack, MenuDivider, MenuItem, MenuList, Spacer, Text } from '@chakra-ui/react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BsFillJournalBookmarkFill } from 'react-icons/bs';
import { IoMdFastforward } from 'react-icons/io';
import { MdPlayArrow, MdPlayDisabled } from 'react-icons/md';
import { useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { EdgeData, NodeData } from '../../common/common-types';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { NodeDocumentationContext } from '../contexts/NodeDocumentationContext';
import { copyToClipboard } from '../helpers/copyAndPaste';
import { UseContextMenu, useContextMenu } from './useContextMenu';
import { NO_DISABLED, UseDisabled } from './useDisabled';
import { NO_PASSTHROUGH, UsePassthrough } from './usePassthrough';
import './useNodeMenu.scss';

export interface UseNodeMenuOptions {
    disabled?: UseDisabled;
    passthrough?: UsePassthrough;
    canLock?: boolean;
    reload?: () => void;
}

export const useNodeMenu = (
    data: NodeData,
    {
        disabled = NO_DISABLED,
        passthrough = NO_PASSTHROUGH,
        canLock = true,
        reload,
    }: UseNodeMenuOptions = {}
): UseContextMenu => {
    const { t } = useTranslation();
    const { openNodeDocumentation } = useContext(NodeDocumentationContext);
    const { id, isLocked = false, schemaId } = data;

    const { removeNodesById, resetInputs, resetConnections, duplicateNodes, toggleNodeLock } =
        useContext(GlobalContext);
    const { isDirectlyDisabled, canDisable, setDirectlyDisabled } = disabled;
    const { canPassthrough, isPassthrough, setIsPassthrough } = passthrough;

    const { getNode, getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    const resetMenuParentRef = useRef<HTMLButtonElement>(null);

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
                {t('nodeMenu.copy', 'Copy')}
            </MenuItem>
            <MenuItem
                icon={<CopyIcon />}
                onClick={() => {
                    duplicateNodes([id]);
                }}
            >
                {t('nodeMenu.duplicate', 'Duplicate')}
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
                    <Text>{t('nodeMenu.resetNode', 'Reset Node')}</Text>
                    <Spacer />
                    <ChevronRightIcon />
                </HStack>
            </MenuItem>
            <div className="useNodeMenu-child">
                <MenuList
                    left={resetMenuParentRef.current?.offsetWidth || 0}
                    marginTop="-55px"
                    position="absolute"
                    top={resetMenuParentRef.current?.offsetHeight || 0}
                >
                    <MenuItem
                        icon={<CloseIcon />}
                        onClick={() => {
                            resetInputs([id]);
                        }}
                    >
                        {t('nodeMenu.resetInputs', 'Reset Inputs')}
                    </MenuItem>
                    <MenuItem
                        icon={<CloseIcon />}
                        onClick={() => {
                            resetConnections([id]);
                        }}
                    >
                        {t('nodeMenu.resetConnections', 'Reset Connections')}
                    </MenuItem>
                    <MenuItem
                        icon={<CloseIcon />}
                        onClick={() => {
                            resetInputs([id]);
                            resetConnections([id]);
                        }}
                    >
                        {t('nodeMenu.resetAll', 'Reset All')}
                    </MenuItem>
                </MenuList>
            </div>
            <MenuDivider />
            {(canDisable || canPassthrough) && (
                <>
                    {(isDirectlyDisabled || isPassthrough) && (
                        <MenuItem
                            icon={<MdPlayArrow />}
                            onClick={() => {
                                setDirectlyDisabled(false);
                                setIsPassthrough(false);
                            }}
                        >
                            {t('nodeMenu.enable', 'Enable')}
                        </MenuItem>
                    )}
                    {!isDirectlyDisabled && (
                        <MenuItem
                            icon={<MdPlayDisabled />}
                            onClick={() => {
                                setDirectlyDisabled(true);
                                setIsPassthrough(false);
                            }}
                        >
                            {t('nodeMenu.disable', 'Disable')}
                        </MenuItem>
                    )}
                    {canPassthrough && (isDirectlyDisabled || !isPassthrough) && (
                        <MenuItem
                            icon={<IoMdFastforward />}
                            onClick={() => {
                                setDirectlyDisabled(false);
                                setIsPassthrough(true);
                            }}
                        >
                            {t('nodeMenu.skip', 'Skip')}
                        </MenuItem>
                    )}
                </>
            )}

            {canLock && (
                <MenuItem
                    icon={isLocked ? <UnlockIcon /> : <LockIcon />}
                    onClick={() => {
                        toggleNodeLock(id);
                    }}
                >
                    {isLocked ? t('nodeMenu.unlock', 'Unlock') : t('nodeMenu.lock', 'Lock')}
                </MenuItem>
            )}

            {reload && (
                <MenuItem
                    icon={<RepeatIcon />}
                    onClick={reload}
                >
                    {t('nodeMenu.refreshPreview', 'Refresh Preview')}
                </MenuItem>
            )}

            <MenuItem
                icon={<DeleteIcon />}
                onClick={() => {
                    removeNodesById([id]);
                }}
            >
                {t('nodeMenu.delete', 'Delete')}
            </MenuItem>
            <MenuDivider />
            <MenuItem
                icon={<BsFillJournalBookmarkFill />}
                onClick={() => {
                    openNodeDocumentation(schemaId);
                }}
            >
                {t('nodeMenu.openDocumentation', 'Open Documentation')}
            </MenuItem>
        </MenuList>
    ));
};
