import { Center, Flex, Icon, Spacer, Spinner, Tooltip, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { BsCheck, BsExclamation } from 'react-icons/bs';
import { Validity } from '../../helpers/checkNodeValidity';

interface NodeFooterProps {
    validity: Validity;
    animated: boolean;
}

const NodeFooter = memo(({ validity, animated }: NodeFooterProps) => {
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
        </Flex>
    );
});

export default NodeFooter;
