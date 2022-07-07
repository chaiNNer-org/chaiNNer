import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';
import { Box, Center, Flex, Icon, Spacer, Tooltip, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { MdPlayArrow, MdPlayDisabled } from 'react-icons/md';
import { Validity } from '../../helpers/checkNodeValidity';
import { UseDisabled } from '../../hooks/useDisabled';

interface NodeFooterProps {
    validity: Validity;
    useDisable: UseDisabled;
}

const NodeFooter = memo(({ validity, useDisable }: NodeFooterProps) => {
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
                            // h="full"
                            // my={-1}
                            // w={6}
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
                <Box width="1em" />
            )}

            <Spacer />
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
                        bgColor={validity.isValid ? validShade : iconShade}
                        borderRadius={100}
                        mr={-3.5}
                        p={1.5}
                    />
                    <Icon
                        as={validity.isValid ? CheckCircleIcon : WarningIcon}
                        color={validity.isValid ? iconShade : invalidShade}
                        cursor="default"
                    />
                </Center>
            </Tooltip>
            <Spacer />
            <Box width="1.8em" />
        </Flex>
    );
});

export default NodeFooter;
