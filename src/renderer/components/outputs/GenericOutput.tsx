import { Center, Flex, Spacer, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { OutputProps } from '../inputs/props';
import { TypeTag } from '../TypeTag';

export const GenericOutput = memo(({ label, id, outputId, useOutputData }: OutputProps) => {
    const type = useContextSelector(GlobalVolatileContext, (c) =>
        c.typeState.functions.get(id)?.outputs.get(outputId)
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const value = useOutputData(outputId);

    return (
        <Flex
            h="full"
            minH="2rem"
            verticalAlign="middle"
            w="full"
        >
            <Spacer />
            {type && (
                <Center
                    h="2rem"
                    verticalAlign="middle"
                >
                    <TypeTag type={type} />
                </Center>
            )}
            <Text
                h="full"
                lineHeight="2rem"
                marginInlineEnd="0.5rem"
                ml={1}
                textAlign="right"
            >
                {label}
            </Text>
        </Flex>
    );
});
