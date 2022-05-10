import {
    CheckCircleIcon,
    CloseIcon,
    CopyIcon,
    DeleteIcon,
    LockIcon,
    UnlockIcon,
    WarningIcon,
} from '@chakra-ui/icons';
import {
    Center,
    Flex,
    Icon,
    Menu,
    MenuButton,
    MenuItem,
    MenuList,
    Portal,
    Spacer,
    Tooltip,
    useColorModeValue,
} from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { MdMoreHoriz } from 'react-icons/md';
import { useContext, useContextSelector } from 'use-context-selector';
import { GlobalChainContext, GlobalContext } from '../../helpers/contexts/GlobalNodeState';
import { MenuFunctionsContext } from '../../helpers/contexts/MenuFunctions';

interface NodeFooterProps {
    id: string;
    isValid?: boolean;
    invalidReason?: string;
    isLocked?: boolean;
}

const NodeFooter = ({ id, isValid = false, invalidReason = '', isLocked }: NodeFooterProps) => {
    const duplicateNode = useContextSelector(GlobalChainContext, (c) => c.duplicateNode);
    const { removeNodeById, clearNode, toggleNodeLock } = useContext(GlobalContext);
    const { addMenuCloseFunction } = useContext(MenuFunctionsContext);

    const iconShade = useColorModeValue('gray.400', 'gray.800');
    const validShade = useColorModeValue('gray.900', 'gray.100');
    // const invalidShade = useColorModeValue('red.200', 'red.900');
    const invalidShade = useColorModeValue('red.400', 'red.600');
    // const iconShade = useColorModeValue('gray.400', 'gray.800');

    const [isOpen, setIsOpen] = useState(false);
    useEffect(() => {
        addMenuCloseFunction(() => {
            setIsOpen(false);
        }, id);
    }, [isOpen]);
    useEffect(() => {
        addMenuCloseFunction(() => {
            setIsOpen(false);
        }, id);
    }, []);

    return (
        <Flex
            pl={2}
            pr={2}
            w="full"
        >
            <Center className="nodrag">
                <Icon
                    as={isLocked ? LockIcon : UnlockIcon}
                    color={iconShade}
                    cursor="pointer"
                    mb={-1}
                    mt={-1}
                    onClick={() => toggleNodeLock(id)}
                />
            </Center>
            <Spacer />
            <Tooltip
                hasArrow
                borderRadius={8}
                closeOnClick={false}
                gutter={24}
                label={isValid ? 'Node valid' : invalidReason}
                px={2}
                py={1}
                textAlign="center"
            >
                <Center
                    className="nodrag"
                    my={-2}
                >
                    <Center
                        bgColor={isValid ? validShade : iconShade}
                        borderRadius={100}
                        mr={-3.5}
                        my={-2}
                        p={1.5}
                    />
                    <Icon
                        as={isValid ? CheckCircleIcon : WarningIcon}
                        // color={useColorModeValue('gray.400', 'gray.800')}
                        color={isValid ? iconShade : invalidShade}
                        cursor="default"
                        my={-2}
                    />
                </Center>
            </Tooltip>
            <Spacer />
            <Center>
                <Menu
                    isOpen={isOpen}
                    onClose={() => {
                        setIsOpen(false);
                    }}
                    onOpen={() => {
                        setIsOpen(true);
                    }}
                    // isLazy
                >
                    <MenuButton
                        as={Center}
                        className="nodrag"
                        cursor="pointer"
                        h={6}
                        mb={-2}
                        mt={-2}
                        verticalAlign="middle"
                        w={6}
                    >
                        <Center>
                            <Icon
                                as={MdMoreHoriz}
                                color={iconShade}
                                h={6}
                                mb={-2}
                                mt={-2}
                                w={6}
                            />
                        </Center>
                    </MenuButton>
                    <Portal>
                        <MenuList>
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
                    </Portal>
                </Menu>
            </Center>
        </Flex>
    );
};

export default memo(NodeFooter);
