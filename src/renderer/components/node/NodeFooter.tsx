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
                    <Center
                        className="nodrag"
                        my={-1}
                        onClick={toggleDirectlyDisabled}
                    >
                        <Center
                            bgColor={iconShade}
                            borderRadius={100}
                            mr={-4}
                            p={2}
                        />
                        <Icon
                            as={isDirectlyDisabled ? MdPlayDisabled : MdPlayArrow}
                            color={validShade}
                            cursor="pointer"
                        />
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
            <Box width="1em" />
        </Flex>
    );
});

export default NodeFooter;
