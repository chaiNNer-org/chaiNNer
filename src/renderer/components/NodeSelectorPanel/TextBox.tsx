import { Box, Center, Text, Tooltip } from '@chakra-ui/react';
import { MouseEventHandler, memo } from 'react';

export interface TextBoxProps {
    text: string;
    collapsed?: boolean;
    toolTip?: React.ReactNode;
    onClick?: MouseEventHandler<HTMLDivElement>;
    height?: string;
    noWrap?: boolean;
}

export const TextBox = memo(
    ({ text, collapsed, toolTip, onClick, height, noWrap = false }: TextBoxProps) => {
        const interactive = !!onClick;

        return (
            <Center
                m={0}
                px={0}
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
                        _hover={
                            interactive
                                ? { backgroundColor: 'var(--selector-text-bg-hover)' }
                                : undefined
                        }
                        bg="var(--selector-text-bg)"
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
                            height={height}
                            textAlign="center"
                            whiteSpace={noWrap ? 'nowrap' : 'inherit'}
                        >
                            {collapsed ? '…' : text}
                        </Text>
                    </Box>
                </Tooltip>
            </Center>
        );
    },
);
