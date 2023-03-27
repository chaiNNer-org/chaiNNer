import { Center, Flex, Spacer, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { TypeTags } from '../TypeTag';
import { OutputProps } from './props';

export const GenericOutput = memo(({ label, id, outputId }: OutputProps) => {
    const type = useContextSelector(GlobalVolatileContext, (c) =>
        c.typeState.functions.get(id)?.outputs.get(outputId)
    );

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
                    <TypeTags
                        isOptional={false}
                        type={type}
                    />
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
