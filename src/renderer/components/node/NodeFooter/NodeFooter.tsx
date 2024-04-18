import { Center, SimpleGrid } from '@chakra-ui/react';
import { memo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { Validity } from '../../../../common/Validity';
import { GlobalVolatileContext } from '../../../contexts/GlobalNodeState';
import { UseDisabled } from '../../../hooks/useDisabled';
import { UsePassthrough } from '../../../hooks/usePassthrough';
import { DisableSwitch } from './DisableSwitch';
import { Timer } from './Timer';
import { ValidityIndicator } from './ValidityIndicator';

interface NodeFooterProps {
    validity: Validity;
    disable: UseDisabled;
    passthrough: UsePassthrough;
    animated: boolean;
    id: string;
}

export const NodeFooter = memo(
    ({ id, validity, disable, passthrough, animated }: NodeFooterProps) => {
        const lastExecutionTime = useContextSelector(
            GlobalVolatileContext,
            (c) => c.outputDataMap.get(id)?.lastExecutionTime
        );

        return (
            <Center
                h="1.5rem"
                px={2}
                w="full"
            >
                <SimpleGrid
                    columns={3}
                    spacing={2}
                    w="full"
                >
                    <Center marginRight="auto">
                        {(disable.canDisable || passthrough.canPassthrough) && (
                            <DisableSwitch
                                disable={disable}
                                passthrough={passthrough}
                            />
                        )}
                    </Center>

                    <Center
                        py={1}
                        w="full"
                    >
                        <ValidityIndicator
                            animated={animated}
                            validity={validity}
                        />
                    </Center>

                    <Center
                        marginLeft="auto"
                        py={1}
                    >
                        {lastExecutionTime !== undefined && <Timer time={lastExecutionTime} />}
                    </Center>
                </SimpleGrid>
            </Center>
        );
    }
);
