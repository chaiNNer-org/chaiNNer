import { Box, HStack, useColorModeValue } from '@chakra-ui/react';
import React, { memo } from 'react';
import { Handle, Position } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { noContextMenu } from '../../hooks/useContextMenu';

interface OutputContainerProps {
    hasHandle: boolean;
    outputId: number;
    id: string;
}

const OutputContainer = memo(
    ({ children, hasHandle, outputId, id }: React.PropsWithChildren<OutputContainerProps>) => {
        const { isValidConnection } = useContext(GlobalVolatileContext);

        let contents = children;
        if (hasHandle) {
            const handleColor = useColorModeValue('#EDF2F7', '#171923');
            const borderColor = useColorModeValue('#171923', '#F7FAFC');
            contents = (
                <HStack
                    h="full"
                    sx={{
                        '.react-flow__handle-connecting': {
                            background: '#E53E3E !important',
                            // cursor: 'not-allowed !important',
                        },
                        '.react-flow__handle-valid': {
                            background: '#38A169 !important',
                        },
                    }}
                >
                    {children}
                    <div style={{ position: 'absolute', right: '-4px', width: 0 }}>
                        <Handle
                            isConnectable
                            id={`${id}-${outputId}`}
                            isValidConnection={isValidConnection}
                            position={Position.Right}
                            style={{
                                width: '15px',
                                height: '15px',
                                borderWidth: '1px',
                                borderColor,
                                transition: '0.25s ease-in-out',
                                background: handleColor,
                            }}
                            type="source"
                            onContextMenu={noContextMenu}
                        />
                    </div>
                </HStack>
            );
        }

        return (
            <Box
                bg={useColorModeValue('gray.200', 'gray.600')}
                p={2}
                w="full"
            >
                {contents}
            </Box>
        );
    }
);

export default OutputContainer;
