import { Box, HStack, useColorModeValue } from '@chakra-ui/react';
import React, { memo } from 'react';
import { Handle, Position } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { interpolateColor } from '../../helpers/colorTools';
import getTypeAccentColors from '../../helpers/getTypeAccentColors';
import { noContextMenu } from '../../hooks/useContextMenu';

interface OutputContainerProps {
    hasHandle: boolean;
    outputId: number;
    id: string;
    accentColor: string;
    type: string;
}

const OutputContainer = memo(
    ({
        children,
        hasHandle,
        outputId,
        id,
        accentColor,
        type,
    }: React.PropsWithChildren<OutputContainerProps>) => {
        const { isValidConnection } = useContext(GlobalContext);

        let contents = children;
        if (hasHandle) {
            const handleColor = getTypeAccentColors(type); // useColorModeValue('#EDF2F7', '#171923');
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
                                borderWidth: '0px',
                                borderColor,
                                transition: '0.25s ease-in-out',
                                background: handleColor,
                                boxShadow: '-2px 2px 2px #00000014',
                            }}
                            type="source"
                            onContextMenu={noContextMenu}
                        />
                    </div>
                </HStack>
            );
        }

        const bgColor = useColorModeValue('#EDF2F7', '#4A5568');

        return (
            <Box
                // bg={useColorModeValue('gray.200', 'gray.600')}
                bg={interpolateColor(accentColor, bgColor, 0.975)}
                p={2}
                w="full"
            >
                {contents}
            </Box>
        );
    }
);

export default OutputContainer;
