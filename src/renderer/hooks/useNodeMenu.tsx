import {
    CheckIcon,
    ChevronRightIcon,
    CloseIcon,
    CopyIcon,
    DeleteIcon,
    LockIcon,
    RepeatIcon,
    UnlockIcon,
} from '@chakra-ui/icons';
import {
    Divider,
    HStack,
    IconButton,
    Input,
    InputGroup,
    InputRightElement,
    MenuDivider,
    MenuItem,
    MenuList,
    Spacer,
    Text,
    VStack,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { BiRename } from 'react-icons/bi';
import { BsFillJournalBookmarkFill } from 'react-icons/bs';
import { MdPlayArrow, MdPlayDisabled } from 'react-icons/md';
import { useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { EdgeData, NodeData } from '../../common/common-types';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { NodeDocumentationContext } from '../contexts/NodeDocumentationContext';
import { copyToClipboard } from '../helpers/copyAndPaste';
import { NodeState } from '../helpers/nodeState';
import { UseContextMenu, useContextMenu } from './useContextMenu';
import { UseDisabled } from './useDisabled';

import './useNodeMenu.scss';

export interface UseNodeMenuOptions {
    canLock?: boolean;
    reload?: () => void;
}

export const useNodeMenu = (
    data: NodeData,
    state: NodeState,
    useDisabled: UseDisabled,
    { canLock = true, reload }: UseNodeMenuOptions = {}
): UseContextMenu => {
    const { openNodeDocumentation } = useContext(NodeDocumentationContext);
    const { id, isLocked = false, schemaId } = data;

    const { removeNodesById, resetInputs, resetConnections, duplicateNodes, toggleNodeLock } =
        useContext(GlobalContext);
    const { isDirectlyDisabled, canDisable, toggleDirectlyDisabled } = useDisabled;

    const { getNode, getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    const resetMenuParentRef = useRef<HTMLButtonElement>(null);

    const [isRenaming, setIsRenaming] = useState(false);
    const [tempName, setTempName] = useState(state.nickname);

    useEffect(() => {
        setTempName(state.nickname);
    }, [state.nickname]);

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
                as="a"
                className="useNodeMenu-container"
                closeOnSelect={false}
                icon={<CloseIcon />}
                ref={resetMenuParentRef}
            >
                <HStack>
                    <Text>Reset Node</Text>
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
                        Reset Inputs
                    </MenuItem>
                    <MenuItem
                        icon={<CloseIcon />}
                        onClick={() => {
                            resetConnections([id]);
                        }}
                    >
                        Reset Connections
                    </MenuItem>
                    <MenuItem
                        icon={<CloseIcon />}
                        onClick={() => {
                            resetInputs([id]);
                            resetConnections([id]);
                        }}
                    >
                        Reset All
                    </MenuItem>
                </MenuList>
            </div>
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

            {isRenaming ? (
                <InputGroup
                    borderRadius={0}
                    maxWidth="full"
                >
                    <Input
                        maxWidth="full"
                        placeholder={state.schema.name}
                        value={tempName}
                        width="auto"
                        onBlur={() => {
                            setIsRenaming(false);
                        }}
                        onChange={(e) => setTempName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setIsRenaming(false);
                                state.setNickname(tempName);
                            }
                        }}
                    />
                    <InputRightElement
                        m={0}
                        overflow="hidden"
                        p={0}
                    >
                        <VStack
                            gap={0}
                            h="full"
                            overflow="hidden"
                        >
                            <IconButton
                                aria-label="Submit"
                                borderRadius={0}
                                borderTopRightRadius="lg"
                                h="50%"
                                icon={<CheckIcon boxSize={2} />}
                                variant="solid"
                                onClick={() => {
                                    state.setNickname(tempName);
                                    setIsRenaming(false);
                                }}
                            />
                            <Divider />
                            <IconButton
                                aria-label="Cancel"
                                borderBottomRightRadius="lg"
                                borderRadius={0}
                                h="50%"
                                icon={<CloseIcon boxSize={2} />}
                                variant="solid"
                                onClick={() => {
                                    setIsRenaming(false);
                                    setTempName(undefined);
                                }}
                            />
                        </VStack>
                    </InputRightElement>
                </InputGroup>
            ) : (
                <MenuItem
                    closeOnSelect={false}
                    icon={<BiRename />}
                    onClick={() => {
                        setIsRenaming(true);
                    }}
                >
                    Rename
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
