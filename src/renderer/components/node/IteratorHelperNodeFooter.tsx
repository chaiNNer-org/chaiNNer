import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';
import { Center, Flex, Icon, Spacer, Tooltip, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { Validity } from '../../helpers/checkNodeValidity';

interface NodeFooterProps {
    validity: Validity;
}

const NodeFooter = memo(({ validity }: NodeFooterProps) => {
    const iconShade = useColorModeValue('gray.400', 'gray.800');
    const validShade = useColorModeValue('gray.900', 'gray.100');
    const invalidShade = useColorModeValue('red.400', 'red.600');

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
                py={1}
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
        </Flex>
    );
});

export default NodeFooter;
