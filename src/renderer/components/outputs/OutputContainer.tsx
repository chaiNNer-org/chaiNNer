import { Box, HStack, chakra, useColorModeValue, useToken } from '@chakra-ui/react';
import React, { memo, useMemo } from 'react';
import { Connection, Handle, Position, useReactFlow } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { intersect } from '../../../common/types/intersection';
import { Type } from '../../../common/types/types';
import { parseHandle } from '../../../common/util';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { SettingsContext } from '../../contexts/SettingsContext';
import getTypeAccentColors from '../../helpers/getTypeAccentColors';
import { noContextMenu } from '../../hooks/useContextMenu';

interface OutputContainerProps {
    hasHandle: boolean;
    outputId: number;
    id: string;
    type: Type;
}

interface RightHandleProps {
    isValidConnection: (connection: Readonly<Connection>) => boolean;
}

// Had to do this garbage to prevent chakra from clashing the position prop
const RightHandle = memo(
    ({ children, isValidConnection, ...props }: React.PropsWithChildren<RightHandleProps>) => (
        <Handle
            isConnectable
            className="output-handle"
            isValidConnection={isValidConnection}
            position={Position.Right}
            type="source"
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...props}
        >
            {children}
        </Handle>
    )
);

const Div = chakra('div', {
    baseStyle: {},
});

const OutputContainer = memo(
    ({
        children,
        hasHandle,
        outputId,
        id,
        type,
    }: React.PropsWithChildren<OutputContainerProps>) => {
        const { isValidConnection, edgeChanges, useConnectingFromType } =
            useContext(GlobalVolatileContext);
        const { useIsDarkMode } = useContext(SettingsContext);
        const [isDarkMode] = useIsDarkMode;

        const { getEdges } = useReactFlow();
        const edges = useMemo(() => getEdges(), [edgeChanges]);
        const isConnected = !!edges.find(
            (e) => e.source === id && parseHandle(e.sourceHandle!).inOutId === outputId
        );
        const [connectingFromType] = useConnectingFromType;

        const showHandle = useMemo(() => {
            if (!connectingFromType) {
                return true;
            }
            if (intersect(connectingFromType, type).type !== 'never') {
                return true;
            }
            return false;
        }, [connectingFromType, type]);

        const { typeDefinitions } = useContext(GlobalContext);

        let contents = children;
        const [handleColor] = getTypeAccentColors(type, typeDefinitions, isDarkMode); // useColorModeValue('#EDF2F7', '#171923');
        const connectedColor = useColorModeValue('#EDF2F7', '#171923');
        if (hasHandle) {
            contents = (
                <HStack
                    h="full"
                    sx={{
                        '.react-flow__handle-connecting': {
                            // background: '#E53E3E !important',
                            opacity: showHandle ? 1 : 0,
                        },
                        '.react-flow__handle-valid': {
                            // background: '#38A169 !important',
                        },
                    }}
                >
                    {children}
                    <div style={{ position: 'absolute', right: '-4px', width: 0 }}>
                        <Div
                            _before={{
                                content: '" "',
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                height: '45px',
                                width: '45px',
                                cursor: 'crosshair',
                                // backgroundColor: '#FF00FF1F',
                                transform: 'translate(-50%, -50%)',
                                borderRadius: '100%',
                            }}
                            _hover={{
                                width: '22px',
                                height: '22px',
                                marginRight: '-3px',
                            }}
                            as={RightHandle}
                            className="output-handle"
                            id={`${id}-${outputId}`}
                            isValidConnection={isValidConnection}
                            sx={{
                                width: '16px',
                                height: '16px',
                                borderWidth: '2px',
                                borderColor: handleColor,
                                transition: '0.15s ease-in-out',
                                background: isConnected ? connectedColor : handleColor,
                                boxShadow: '-2px 2px 2px #00000014',
                                opacity: showHandle ? 1 : 0.5,
                            }}
                            onContextMenu={noContextMenu}
                        />
                    </div>
                </HStack>
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const [gray300, gray700]: string[] = useToken('colors', ['gray.300', 'gray.700']);

        const bgColor = useColorModeValue(gray300, gray700);

        return (
            <Box
                // bg={useColorModeValue('gray.200', 'gray.600')}
                // bg={interpolateColor(accentColor, bgColor, 0.95)}
                bg={bgColor}
                p={2}
                w="full"
            >
                {contents}
            </Box>
        );
    }
);

export default OutputContainer;
