import { Center, Icon, Spinner, Tooltip, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { BsCheck, BsExclamation } from 'react-icons/bs';
import { Validity } from '../../../helpers/checkNodeValidity';
import { DisabledStatus } from '../../../helpers/disabled';

interface ValidityIndicatorProps {
    validity: Validity;
    animated: boolean;
    status: DisabledStatus;
}

export const ValidityIndicator = memo(({ validity, animated, status }: ValidityIndicatorProps) => {
    const iconShade = useColorModeValue('gray.400', 'gray.800');
    const validShade = useColorModeValue('gray.900', 'gray.100');
    const invalidShade = useColorModeValue('red.400', 'red.600');

    return animated && status === DisabledStatus.Enabled ? (
        <Tooltip
            hasArrow
            borderRadius={8}
            closeOnClick={false}
            gutter={24}
            label="This node is currently running..."
            px={2}
            textAlign="center"
        >
            <Center className="nodrag">
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
            <Center className="nodrag">
                <Center
                    bgColor={validity.isValid ? iconShade : invalidShade}
                    borderRadius={100}
                    h="auto"
                    w="auto"
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
    );
});
