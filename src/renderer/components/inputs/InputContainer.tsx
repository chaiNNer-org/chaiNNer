import { Box, HStack, Text, useColorModeValue } from '@chakra-ui/react';
import React, { memo } from 'react';
import { Handle, Position } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { noContextMenu } from '../../hooks/useContextMenu';

interface InputContainerProps {
    id: string;
    inputId: number;
    label?: string;
    hasHandle: boolean;
}

const InputContainer = memo(
    ({ children, hasHandle, id, inputId, label }: React.PropsWithChildren<InputContainerProps>) => {
        const { isValidConnection } = useContext(GlobalVolatileContext);

        let contents = children;
        const handleColor = useColorModeValue('#EDF2F7', '#171923');
        const borderColor = useColorModeValue('#171923', '#F7FAFC');
        if (hasHandle) {
            contents = (
                <HStack
                    h="full"
                    sx={{
                        '.react-flow__handle-connecting': {
                            background: '#E53E3E !important',
                        },
                        '.react-flow__handle-valid': {
                            background: '#38A169 !important',
                        },
                    }}
                >
                    <div style={{ position: 'absolute', left: '-4px', width: 0 }}>
                        <Handle
                            isConnectable
                            className="input-handle"
                            id={`${id}-${inputId}`}
                            isValidConnection={isValidConnection}
                            position={Position.Left}
                            style={{
                                width: '15px',
                                height: '15px',
                                borderWidth: '1px',
                                borderColor,
                                transition: '0.25s ease-in-out',
                                background: handleColor,
                            }}
                            type="target"
                            onContextMenu={noContextMenu}
                        />
                    </div>
                    {children}
                </HStack>
            );
        }

        return (
            <Box
                bg={useColorModeValue('gray.100', 'gray.600')}
                p={2}
                w="full"
            >
                <Text
                    display={label ? 'block' : 'none'}
                    fontSize="xs"
                    mt={-1}
                    p={1}
                    pt={-1}
                    textAlign="center"
                >
                    {label}
                </Text>
                {contents}
            </Box>
        );
    }
);

export default InputContainer;
