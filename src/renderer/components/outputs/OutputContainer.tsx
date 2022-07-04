import { Box, Center, HStack, chakra, useColorModeValue } from '@chakra-ui/react';
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
        const { isValidConnection, edgeChanges, useConnectingFromType, useConnectingFrom } =
            useContext(GlobalVolatileContext);
        const { useIsDarkMode } = useContext(SettingsContext);
        const [isDarkMode] = useIsDarkMode;

        const { getEdges } = useReactFlow();
        const edges = useMemo(() => getEdges(), [edgeChanges]);
        const isConnected = !!edges.find(
            (e) => e.source === id && parseHandle(e.sourceHandle!).inOutId === outputId
        );
        const [connectingFromType] = useConnectingFromType;
        const [connectingFrom] = useConnectingFrom;

        const showHandle = useMemo(() => {
            if (
                !connectingFrom ||
                !connectingFromType ||
                // We want to display the connectingFrom handle
                (connectingFrom.handleId === `${id}-${outputId}` &&
                    connectingFrom.handleType === 'source')
            ) {
                return true;
            }
            if (connectingFrom.nodeId === id) {
                return false;
            }
            if (connectingFrom.handleType === 'source') {
                return false;
            }
            const connectionIsValid = isValidConnection({
                source: connectingFrom.nodeId,
                sourceHandle: connectingFrom.handleId,
                target: id,
                targetHandle: `${id}-${outputId}`,
            });
            if (connectionIsValid && intersect(connectingFromType, type).type !== 'never') {
                return true;
            }
            return false;
        }, [connectingFromType, connectingFrom, type, id, outputId]);

        const { typeDefinitions } = useContext(GlobalContext);

        let contents = children;
        const [handleColor] = getTypeAccentColors(type, typeDefinitions, isDarkMode);
        const connectedColor = useColorModeValue('#EDF2F7', '#171923');
        if (hasHandle) {
            contents = (
                <HStack
                    h="full"
                    sx={{
                        '.react-flow__handle-connecting': {
                            opacity: showHandle ? 1 : 0,
                        },
                        '.react-flow__handle-valid': {},
                    }}
                >
                    {children}
                    <Center
                        position="absolute"
                        right="-6px"
                    >
                        <Div
                            _before={{
                                content: '" "',
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                height: '45px',
                                width: '45px',
                                cursor: 'crosshair',
                                transform: 'translate(-50%, -50%)',
                                borderRadius: '100%',
                            }}
                            _hover={{
                                width: '22px',
                                height: '22px',
                                marginRight: '-3px',
                                opacity: showHandle ? 1 : 0,
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
                                filter: showHandle ? undefined : 'grayscale(100%)',
                                opacity: showHandle ? 1 : 0.3,
                                position: 'relative',
                            }}
                            onContextMenu={noContextMenu}
                        />
                    </Center>
                </HStack>
            );
        }

        const bgColor = useColorModeValue('gray.300', 'gray.700');

        return (
            <Box
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
