import { Box, Center } from '@chakra-ui/react';
import { memo } from 'react';
import { Validity } from '../../../helpers/checkNodeValidity';
import { UseDisabled } from '../../../hooks/useDisabled';
import DisableToggle from './DisableToggle';
import ValidityIndicator from './ValidityIndicator';

interface NodeFooterProps {
    validity: Validity;
    useDisable: UseDisabled;
    animated: boolean;
}

const NodeFooter = memo(({ validity, useDisable, animated }: NodeFooterProps) => {
    const { canDisable } = useDisable;

    return (
        <Center
            h="1.5rem"
            px={2}
            py={1}
            w="full"
        >
            {canDisable ? (
                <DisableToggle useDisable={useDisable} />
            ) : (
                <Box
                    p="1px"
                    width={7}
                />
            )}

            <Center w="full">
                <ValidityIndicator
                    animated={animated}
                    validity={validity}
                />
            </Center>

            <Box
                p="1px"
                width={7}
            />
        </Center>
    );
});

export default NodeFooter;
