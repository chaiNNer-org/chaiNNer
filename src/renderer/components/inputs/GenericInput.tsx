import { Box, Center, Tag, Text, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { InputProps } from './props';

type GenericInputProps = InputProps;

export const GenericInput = memo(({ label, optional, hasHandle }: GenericInputProps) => {
    const tagColor = useColorModeValue('gray.400', 'gray.750');
    const tagFontColor = useColorModeValue('gray.700', 'gray.400');
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
            {label && optional && hasHandle && (
                <Center
                    h="2rem"
                    verticalAlign="middle"
                >
                    <Tag
                        bgColor={tagColor}
                        color={tagFontColor}
                        fontSize="xx-small"
                        fontStyle="italic"
                        height="14px"
                        lineHeight="auto"
                        minHeight="14px"
                        ml={1}
                        px={1}
                        size="sm"
                        variant="subtle"
                        verticalAlign="middle"
                    >
                        optional
                    </Tag>
                </Center>
            )}
        </Box>
    );
});
