import { Center, SimpleGrid } from '@chakra-ui/react';
import { memo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { Validity } from '../../../../common/Validity';
import { GlobalVolatileContext } from '../../../contexts/GlobalNodeState';
import { UseDisabled } from '../../../hooks/useDisabled';
import { DisableToggle } from './DisableToggle';
import { Timer } from './Timer';
import { ValidityIndicator } from './ValidityIndicator';

interface NodeFooterProps {
    validity: Validity;
    useDisable?: UseDisabled;
    animated: boolean;
    id: string;
}

export const NodeFooter = memo(({ id, validity, useDisable, animated }: NodeFooterProps) => {
    const { canDisable } = useDisable ?? { canDisable: false };
    const lastExecutionTime = useContextSelector(
        GlobalVolatileContext,
        (c) => c.outputDataMap.get(id)?.lastExecutionTime
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
                    {canDisable && useDisable && <DisableToggle useDisable={useDisable} />}
                </Center>

                <Center w="full">
                    <ValidityIndicator
                        animated={animated}
                        validity={validity}
                    />
                </Center>

                <Center marginLeft="auto">
                    {lastExecutionTime !== undefined && <Timer time={lastExecutionTime} />}
                </Center>
            </SimpleGrid>
        </Center>
    );
});
