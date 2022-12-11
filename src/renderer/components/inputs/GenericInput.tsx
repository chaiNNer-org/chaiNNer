import { Box, Center, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { TypeTags } from '../TypeTag';
import { WithoutLabel } from './InputContainer';
import { InputProps } from './props';

export const GenericInput = memo(({ input, definitionType }: InputProps<'generic'>) => {
    const { label, optional } = input;

    return (
        <WithoutLabel>
            <Box
                display="flex"
                flexDirection="row"
            >
                <Text>{label}</Text>
                <Center>
                    <TypeTags
                        isOptional={optional}
                        type={definitionType}
                    />
                </Center>
            </Box>
        </WithoutLabel>
    );
});
