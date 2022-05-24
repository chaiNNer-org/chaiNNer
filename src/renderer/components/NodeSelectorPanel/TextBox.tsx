import { Box, Center, Text, Tooltip, useColorModeValue } from '@chakra-ui/react';
import { MouseEventHandler, memo } from 'react';

export interface TextBoxProps {
    text: string;
    toolTip?: React.ReactNode;
    onClick?: MouseEventHandler<HTMLDivElement>;
}

export const TextBox = memo(({ text, toolTip, onClick }: TextBoxProps) => {
    const interactive = !!onClick;

    return (
        <Center
            m={0}
            p={3}
            textOverflow="ellipsis"
            w="full"
        >
            <Tooltip
                closeOnMouseDown
                hasArrow
                borderRadius={8}
                label={toolTip}
                px={2}
                py={1}
            >
                <Box
                    _hover={interactive ? { backgroundColor: 'gray.600' } : undefined}
                    bg={useColorModeValue('gray.200', 'gray.700')}
                    borderRadius={10}
                    cursor={interactive ? 'pointer' : undefined}
                    p={2}
                    sx={
                        interactive
                            ? { cursor: 'pointer !important', transition: '0.15s ease-in-out' }
                            : undefined
                    }
                    w="full"
                    onClick={onClick}
                >
                    <Text
                        cursor="inherit"
                        fontSize="sm"
                        fontWeight="bold"
                        textAlign="center"
                    >
                        {text}
                    </Text>
                </Box>
            </Tooltip>
        </Center>
    );
});
