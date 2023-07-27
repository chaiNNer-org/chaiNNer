import { Center, Flex, Spacer, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { TypeTags } from '../TypeTag';
import { OutputProps } from './props';

export const GenericOutput = memo(({ output, type }: OutputProps) => {
    return (
        <Flex
            h="full"
            minH="2rem"
            verticalAlign="middle"
            w="full"
        >
            <Spacer />
            <Center
                h="2rem"
                verticalAlign="middle"
            >
                <TypeTags
                    isOptional={false}
                    type={type}
                />
            </Center>
            <Text
                h="full"
                lineHeight="2rem"
                marginInlineEnd="0.5rem"
                ml={1}
                textAlign="right"
                whiteSpace="nowrap"
            >
                {output.label}
            </Text>
        </Flex>
    );
});
