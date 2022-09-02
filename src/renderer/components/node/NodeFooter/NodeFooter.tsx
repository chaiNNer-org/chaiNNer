import { TimeIcon } from '@chakra-ui/icons';
import { Center, HStack, SimpleGrid, Text, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { GlobalVolatileContext } from '../../../contexts/GlobalNodeState';
import { Validity } from '../../../helpers/checkNodeValidity';
import { UseDisabled } from '../../../hooks/useDisabled';
import { DisableToggle } from './DisableToggle';
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
    console.log(
        '🚀 ~ file: NodeFooter.tsx ~ line 22 ~ NodeFooter ~ outputDataEntry',
        outputDataEntry
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
                        <Tooltip
                            hasArrow
                            borderRadius={8}
                            closeOnClick={false}
                            gutter={24}
                            label={`Execution took approximately ${outputDataEntry.lastExecutionTime.toPrecision(
                                6
                            )} seconds.`}
                            px={2}
                            textAlign="center"
                        >
                            <HStack
                                bgColor="var(--gray-800)"
                                borderRadius="full"
                                h="full"
                                margin="auto"
                                px={1}
                                spacing={0.5}
                                width="auto"
                            >
                                <TimeIcon
                                    boxSize="0.5rem"
                                    color="var(--gray-600)"
                                />
                                <Text
                                    color="var(--gray-600)"
                                    fontSize="xx-small"
                                    // fontWeight={500}
                                    textAlign="right"
                                >
                                    {Number(outputDataEntry.lastExecutionTime.toFixed(2))}s
                                </Text>
                            </HStack>
                        </Tooltip>
                    )}
                </Center>
            </SimpleGrid>
        </Center>
    );
});
