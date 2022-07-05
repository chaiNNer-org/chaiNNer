import { Box, Tag, Text, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { InputProps } from './props';

type GenericInputProps = InputProps;

const GenericInput = memo(({ label, optional }: GenericInputProps) => {
    const tagColor = useColorModeValue('gray.400', 'gray.750');
    const tagFontColor = useColorModeValue('gray.700', 'gray.400');
    return (
        // These both need to have -1 margins to thin it out... I don't know why
        <Box
            display="flex"
            flexDirection="row"
            mb={-1}
            mt={-1}
            w="full"
        >
            <Text
                mb={-1}
                mt={-1}
                textAlign="left"
            >
                {label}
            </Text>
            <Tag
                bgColor={tagColor}
                color={tagFontColor}
                display={label && optional ? 'block' : 'none'}
                fontSize="xx-small"
                fontStyle="italic"
                height="15px"
                lineHeight="auto"
                minHeight="auto"
                ml={1}
                px={1}
                py={0}
                size="sm"
                variant="subtle"
            >
                optional
            </Tag>
        </Box>
    );
});

export default GenericInput;
