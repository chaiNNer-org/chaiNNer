import { Flex, Spacer, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { TypeTags } from '../TypeTag';
import { OutputProps } from './props';

export const GenericOutput = memo(({ output, type }: OutputProps) => {
    return (
        <Flex
            alignItems="center"
            h="2rem"
            style={{ contain: 'layout size' }}
            verticalAlign="middle"
            w="full"
        >
            <Spacer />
            <TypeTags
                longText
                isOptional={false}
                type={type}
            />
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
