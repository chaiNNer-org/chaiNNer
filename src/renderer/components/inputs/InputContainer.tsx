import { Box, HStack, Text, useColorModeValue } from '@chakra-ui/react';
import React, { memo } from 'react';
import { Handle, Position } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { interpolateColor } from '../../helpers/colorTools';
import getTypeAccentColors from '../../helpers/getTypeAccentColors';
import { noContextMenu } from '../../hooks/useContextMenu';

interface InputContainerProps {
    id: string;
    inputId: number;
    label?: string;
    hasHandle: boolean;
    accentColor: string;
    type: string;
}

const InputContainer = memo(
    ({
        children,
        hasHandle,
        id,
        inputId,
        label,
        accentColor,
        type,
    }: React.PropsWithChildren<InputContainerProps>) => {
        const { isValidConnection } = useContext(GlobalContext);

        let contents = children;
        if (hasHandle) {
            const handleColor = getTypeAccentColors(type); // useColorModeValue('#EDF2F7', '#171923');
            const borderColor = useColorModeValue('#171923', '#F7FAFC'); // shadeColor(handleColor, 25); // useColorModeValue('#171923', '#F7FAFC');
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
                                borderWidth: '0px',
                                borderColor,
                                transition: '0.25s ease-in-out',
                                background: handleColor,
                                boxShadow: '2px 2px 2px #00000014',
                            }}
                            type="target"
                            onContextMenu={noContextMenu}
                        />
                    </div>
                    {children}
                </HStack>
            );
        }

        const bgColor = useColorModeValue('#EDF2F7', '#4A5568');

        return (
            <Box
                // bg={useColorModeValue('gray.100', 'gray.600')}
                bg={interpolateColor(accentColor, bgColor, 0.975)}
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
