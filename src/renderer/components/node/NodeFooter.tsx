import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';
import { Center, Flex, Icon, Spacer, Tooltip, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { MdPlayDisabled } from 'react-icons/md';
import { Validity } from '../../helpers/checkNodeValidity';
import { DisabledStatus } from '../../helpers/disabled';

interface NodeFooterProps {
    validity: Validity;
    disabledStatus: DisabledStatus;
}

const NodeFooter = memo(({ validity, disabledStatus }: NodeFooterProps) => {
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
            {disabledStatus.isDisabled && (
                <Tooltip
                    hasArrow
                    borderRadius={8}
                    closeOnClick={false}
                    gutter={24}
                    label={disabledStatus.reason}
                    px={2}
                    textAlign="center"
                >
                    <Center
                        className="nodrag"
                        my={-1}
                    >
                        <Center
                            bgColor={iconShade}
                            borderRadius={100}
                            mr={-4}
                            p={2}
                        />
                        <Icon
                            as={MdPlayDisabled}
                            color={validShade}
                            cursor="default"
                        />
                    </Center>
                </Tooltip>
            )}
            <Spacer />
        </Flex>
    );
});

export default NodeFooter;
