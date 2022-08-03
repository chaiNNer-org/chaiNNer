import { Box, Center, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { TypeTags } from '../TypeTag';
import { InputProps } from './props';

type GenericInputProps = InputProps;

export const GenericInput = memo(({ label, definitionType }: GenericInputProps) => {
    return (
        // These both need to have -1 margins to thin it out... I don't know why
        <Box
            display="flex"
            flexDirection="row"
            h="full"
            minH="2rem"
            verticalAlign="middle"
            w="full"
        >
            <Text
                h="full"
                lineHeight="2rem"
                textAlign="left"
            >
                {label}
            </Text>
            <Center
                h="2rem"
                verticalAlign="middle"
            >
                <TypeTags type={definitionType} />
            </Center>
        </Box>
    );
});
