import { CheckCircleIcon, LockIcon, UnlockIcon, WarningIcon } from '@chakra-ui/icons';
import { Center, Flex, Icon, Spacer, Tooltip, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { MdMoreHoriz } from 'react-icons/md';
import { useContext } from 'use-context-selector';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { UseContextMenu } from '../../hooks/useContextMenu';

interface NodeFooterProps {
    id: string;
    isValid?: boolean;
    invalidReason?: string;
    isLocked?: boolean;
    menu?: UseContextMenu;
}

const NodeFooter = ({
    id,
    isValid = false,
    invalidReason = '',
    isLocked,
    menu,
}: NodeFooterProps) => {
    const { toggleNodeLock } = useContext(GlobalContext);

    const iconShade = useColorModeValue('gray.400', 'gray.800');
    const validShade = useColorModeValue('gray.900', 'gray.100');
    // const invalidShade = useColorModeValue('red.200', 'red.900');
    const invalidShade = useColorModeValue('red.400', 'red.600');
    // const iconShade = useColorModeValue('gray.400', 'gray.800');

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
            {menu && (
                <Center className="nodrag">
                    <Icon
                        as={MdMoreHoriz}
                        color={iconShade}
                        cursor="pointer"
                        h={6}
                        mb={-2}
                        mt={-2}
                        w={6}
                        onClick={menu.onClick}
                    />
                </Center>
            )}
        </Flex>
    );
}

export default memo(NodeFooter);
