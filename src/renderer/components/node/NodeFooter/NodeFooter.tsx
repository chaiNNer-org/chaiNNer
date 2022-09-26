import { Center, SimpleGrid } from '@chakra-ui/react';
import { memo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { Validity } from '../../../../common/checkNodeValidity';
import { GlobalVolatileContext } from '../../../contexts/GlobalNodeState';
import { UseDisabled } from '../../../hooks/useDisabled';
import { DisableToggle } from './DisableToggle';
import { Timer } from './Timer';
import { ValidityIndicator } from './ValidityIndicator';

interface NodeFooterProps {
    validity: Validity;
    useDisable: UseDisabled;
    animated: boolean;
    id: string;
}

export const NodeFooter = memo(({ id, validity, useDisable, animated }: NodeFooterProps) => {
    const { canDisable } = useDisable;
    const outputDataEntry = useContextSelector(GlobalVolatileContext, (c) =>
        c.outputDataMap.get(id)
    );

    return (
        <Center
            h="1.5rem"
            px={2}
            py={1}
            w="full"
        >
            <SimpleGrid
                columns={3}
                spacing={2}
                w="full"
            >
                <Center marginRight="auto">
                    {canDisable && <DisableToggle useDisable={useDisable} />}
                </Center>

                <Center w="full">
                    <ValidityIndicator
                        animated={animated}
                        validity={validity}
                    />
                </Center>

                <Center marginLeft="auto">
                    {outputDataEntry?.lastExecutionTime !== undefined && (
                        <Timer time={outputDataEntry.lastExecutionTime} />
                    )}
                </Center>
            </SimpleGrid>
        </Center>
    );
});
