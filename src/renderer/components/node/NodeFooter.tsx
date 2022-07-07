import {
    Box,
    Center,
    Flex,
    Icon,
    Spacer,
    Spinner,
    Tooltip,
    useColorModeValue,
} from '@chakra-ui/react';
import { memo } from 'react';
import { BsCheck, BsExclamation } from 'react-icons/bs';
import { MdPlayArrow, MdPlayDisabled } from 'react-icons/md';
import { Validity } from '../../helpers/checkNodeValidity';
import { UseDisabled } from '../../hooks/useDisabled';

interface NodeFooterProps {
    validity: Validity;
    useDisable: UseDisabled;
    animated: boolean;
}

const NodeFooter = memo(({ validity, useDisable, animated }: NodeFooterProps) => {
    const iconShade = useColorModeValue('gray.400', 'gray.800');
    const validShade = useColorModeValue('gray.900', 'gray.100');
    const switchShade = useColorModeValue('gray.500', 'gray.600');
    // const invalidShade = useColorModeValue('red.200', 'red.900');
    const invalidShade = useColorModeValue('red.400', 'red.600');
    // const iconShade = useColorModeValue('gray.400', 'gray.800');

    const { canDisable, isDirectlyDisabled, toggleDirectlyDisabled } = useDisable;

    return (
        <Flex
            pl={2}
            pr={2}
            w="full"
        >
            {canDisable ? (
                <Tooltip
                    hasArrow
                    borderRadius={8}
                    gutter={24}
                    label={
                        isDirectlyDisabled
                            ? 'Click to enable this node.'
                            : 'Click to disable this node from executing.'
                    }
                    openDelay={500}
                    px={2}
                    textAlign="center"
                >
                    <Center my={-1}>
                        <Center
                            className="nodrag"
                            onClick={toggleDirectlyDisabled}
                        >
                            <Center
                                bgColor={iconShade}
                                borderRadius="lg"
                                cursor="pointer"
                                h="full"
                                p="1px"
                                verticalAlign="middle"
                                w={7}
                            >
                                <Center
                                    bgColor={switchShade}
                                    borderRadius="100%"
                                    cursor="pointer"
                                    ml={isDirectlyDisabled ? 0 : '50%'}
                                    mr={isDirectlyDisabled ? '50%' : 0}
                                    transition="all 0.1s ease-in-out"
                                >
                                    <Icon
                                        as={isDirectlyDisabled ? MdPlayDisabled : MdPlayArrow}
                                        boxSize="0.8rem"
                                        color={iconShade}
                                    />
                                </Center>
                            </Center>
                        </Center>
                    </Center>
                </Tooltip>
            ) : (
                <Box
                    p="1px"
                    width={7}
                />
            )}

            <Spacer />
            {animated ? (
                <Tooltip
                    hasArrow
                    borderRadius={8}
                    closeOnClick={false}
                    gutter={24}
                    label="This node is currently running..."
                    px={2}
                    textAlign="center"
                >
                    <Center
                        className="nodrag"
                        my={-1}
                    >
                        <Spinner size="xs" />
                    </Center>
                </Tooltip>
            ) : (
                <Tooltip
                    hasArrow
                    borderRadius={8}
                    closeOnClick={false}
                    gutter={24}
                    label={validity.isValid ? 'Node valid' : validity.reason}
                    px={2}
                    textAlign="center"
                >
                    <Center
                        className="nodrag"
                        my={-1}
                    >
                        <Center
                            bgColor={validity.isValid ? iconShade : invalidShade}
                            borderRadius={100}
                            boxSize="1rem"
                        >
                            <Icon
                                as={validity.isValid ? BsCheck : BsExclamation}
                                boxSize="1rem"
                                color={validity.isValid ? validShade : iconShade}
                                cursor="default"
                                m="auto"
                            />
                        </Center>
                    </Center>
                </Tooltip>
            )}
            <Spacer />
            <Box
                p="1px"
                width={7}
            />
        </Flex>
    );
});

export default NodeFooter;
