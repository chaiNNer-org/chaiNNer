import { Box, Center, HStack, Text, chakra, useColorModeValue } from '@chakra-ui/react';
import React, { memo, useMemo } from 'react';
import { Connection, Handle, Node, Position, useReactFlow } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { InputId, NodeData } from '../../../common/common-types';
import { Type } from '../../../common/types/types';
import { parseSourceHandle, parseTargetHandle, stringifyTargetHandle } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { SettingsContext } from '../../contexts/SettingsContext';
import { defaultColor, getTypeAccentColors } from '../../helpers/getTypeAccentColors';
import { noContextMenu } from '../../hooks/useContextMenu';
import { TypeTag } from '../TypeTag';

interface InputContainerProps {
    id: string;
    inputId: InputId;
    label?: string;
    hasHandle: boolean;
    definitionType: Type;
    optional: boolean;
    generic: boolean;
}

interface LeftHandleProps {
    isValidConnection: (connection: Readonly<Connection>) => boolean;
}

// Had to do this garbage to prevent chakra from clashing the position prop
const LeftHandle = memo(
    ({ children, isValidConnection, ...props }: React.PropsWithChildren<LeftHandleProps>) => (
        <Handle
            isConnectable
            className="input-handle"
            isValidConnection={isValidConnection}
            position={Position.Left}
            type="target"
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

export const InputContainer = memo(
    ({
        children,
        hasHandle,
        id,
        inputId,
        label,
        definitionType,
        optional,
        generic,
    }: React.PropsWithChildren<InputContainerProps>) => {
        const { isValidConnection, edgeChanges, useConnectingFrom } =
            useContext(GlobalVolatileContext);
        const { getEdges, getNode } = useReactFlow();
        const edges = useMemo(() => getEdges(), [edgeChanges]);
        const connectedEdge = edges.find(
            (e) => e.target === id && parseTargetHandle(e.targetHandle!).inOutId === inputId
        );
        const isConnected = !!connectedEdge;
        const [connectingFrom] = useConnectingFrom;

        const showHandle = useMemo(() => {
            // no active connection
            if (!connectingFrom) return true;

            const targetHandle = stringifyTargetHandle(id, inputId);

            // We only want to display the connectingFrom target handle
            if (connectingFrom.handleType === 'target')
                return connectingFrom.handleId === targetHandle;

            // Show same types
            return isValidConnection({
                source: connectingFrom.nodeId,
                sourceHandle: connectingFrom.handleId,
                target: id,
                targetHandle,
            });
        }, [connectingFrom, definitionType, id, inputId]);

        const { functionDefinitions } = useContext(BackendContext);
        const { useIsDarkMode } = useContext(SettingsContext);
        const [isDarkMode] = useIsDarkMode;

        let contents = children;
        const handleColors = getTypeAccentColors(definitionType, isDarkMode);

        const parentTypeColor = useMemo(() => {
            if (connectedEdge) {
                const parentNode: Node<NodeData> | undefined = getNode(connectedEdge.source);
                const parentOutputId = parseSourceHandle(connectedEdge.sourceHandle!).inOutId;
                if (parentNode) {
                    const parentDef = functionDefinitions.get(parentNode.data.schemaId);
                    if (!parentDef) {
                        return defaultColor;
                    }
                    const parentType = parentDef.outputDefaults.get(parentOutputId);
                    if (!parentType) {
                        return defaultColor;
                    }
                    return getTypeAccentColors(parentType, isDarkMode)[0];
                }
                return defaultColor;
            }
            return null;
        }, [connectedEdge, functionDefinitions, getNode, isDarkMode]);

        // A conic gradient that uses all handle colors to give an even distribution of colors
        const handleColorString = handleColors
            .map((color, index) => {
                const percent = index / handleColors.length;
                const nextPercent = (index + 1) / handleColors.length;
                return `${color} ${percent * 100}% ${nextPercent * 100}%`;
            })
            .join(', ');
        const handleGradient = `conic-gradient(from 90deg, ${handleColorString})`;
        const connectedColor = useColorModeValue('#EDF2F7', '#171923');
        if (hasHandle) {
            contents = (
                <HStack h="full">
                    <Center
                        left="-6px"
                        position="absolute"
                    >
                        <Div
                            _before={{
                                content: '" "',
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                height: '30px',
                                width: '45px',
                                cursor: 'crosshair',
                                transform: 'translate(-50%, -50%)',
                                borderRadius: '100%',
                            }}
                            _hover={{
                                width: '22px',
                                height: '22px',
                                marginLeft: '-3px',
                                opacity: showHandle ? 1 : 0,
                            }}
                            as={LeftHandle}
                            className="input-handle"
                            id={stringifyTargetHandle(id, inputId)}
                            isValidConnection={isValidConnection}
                            sx={{
                                width: '16px',
                                height: '16px',
                                borderWidth: isConnected ? '2px' : '0px',
                                borderColor: parentTypeColor ?? 'none',
                                transition: '0.15s ease-in-out',
                                ...(handleColors.length > 1
                                    ? { background: isConnected ? connectedColor : handleGradient }
                                    : {}),
                                backgroundColor: isConnected ? connectedColor : handleColors[0],
                                boxShadow: '2px 2px 2px #00000014',
                                filter: showHandle ? undefined : 'grayscale(100%)',
                                opacity: showHandle ? 1 : 0.3,
                                position: 'relative',
                            }}
                            onContextMenu={noContextMenu}
                        >
                            {/* // TODO: This would be for icons, if the time ever comes */}
                            {/* <Center
                                h="full"
                                w="full"
                            >
                                <CloseIcon
                                    boxSize={2}
                                />
                            </Center> */}
                        </Div>
                    </Center>
                    {children}
                </HStack>
            );
        }

        const bgColor = useColorModeValue('gray.300', 'gray.700');

        return (
            <Box
                bg={bgColor}
                h="auto"
                minH="2rem"
                px={2}
                verticalAlign="middle"
                w="full"
            >
                {!generic && (
                    <Center
                        h="1.25rem"
                        p={1}
                        verticalAlign="middle"
                    >
                        <Text
                            display={label ? 'block' : 'none'}
                            fontSize="xs"
                            lineHeight="0.9rem"
                            textAlign="center"
                        >
                            {label}
                        </Text>
                        {label && optional && (
                            <Center
                                h="1rem"
                                verticalAlign="middle"
                            >
                                <TypeTag isOptional>optional</TypeTag>
                            </Center>
                        )}
                    </Center>
                )}
                <Box pb={generic ? 0 : 2}>{contents}</Box>
            </Box>
        );
    }
);
