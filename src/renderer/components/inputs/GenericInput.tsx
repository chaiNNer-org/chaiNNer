import { Box, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { InputProps } from './props';

type GenericInputProps = InputProps;

const GenericInput = memo(({ label, optional }: GenericInputProps) => (
    // These both need to have -1 margins to thin it out... I don't know why
    <Box
        display="flex"
        flexDirection="row"
        mb={-1}
        mt={-1}
    >
        <Text
            mb={-1}
            mt={-1}
            textAlign="left"
            w="full"
        >
            {label}
        </Text>
        <Text
            color="red.500"
            display={label && !optional ? 'block' : 'none'}
            fontSize="xs"
            h="full"
            mb={-1}
            ml={1}
            mt={-1}
            textAlign="left"
        >
            *
        </Text>
    </Box>
));

export default GenericInput;
