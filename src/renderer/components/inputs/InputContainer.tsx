import { Box, Center, HStack, Text, chakra, useColorModeValue } from '@chakra-ui/react';
import React, { memo, useMemo } from 'react';
import { Connection, Handle, Node, Position, useReactFlow } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { NodeData } from '../../../common/common-types';
import { intersect } from '../../../common/types/intersection';
import { Type } from '../../../common/types/types';
import { parseHandle } from '../../../common/util';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { SettingsContext } from '../../contexts/SettingsContext';
import getTypeAccentColors from '../../helpers/getTypeAccentColors';
import { noContextMenu } from '../../hooks/useContextMenu';

interface InputContainerProps {
    id: string;
    inputId: number;
    label?: string;
    hasHandle: boolean;
    type: Type;
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

const InputContainer = memo(
    ({
        children,
        hasHandle,
        id,
        inputId,
        label,
        type,
    }: React.PropsWithChildren<InputContainerProps>) => {
        const { isValidConnection, edgeChanges, useConnectingFromType, useConnectingFrom } =
            useContext(GlobalVolatileContext);
        const { getEdges, getNode } = useReactFlow();
        const edges = useMemo(() => getEdges(), [edgeChanges]);
        const connectedEdge = edges.find(
            (e) => e.target === id && parseHandle(e.targetHandle!).inOutId === inputId
        );
        const isConnected = !!connectedEdge;
        const [connectingFromType] = useConnectingFromType;
        const [connectingFrom] = useConnectingFrom;

        const showHandle = useMemo(() => {
            if (
                !connectingFrom ||
                !connectingFromType ||
                // We want to display the connectingFrom handle
                (connectingFrom.handleId === `${id}-${inputId}` &&
                    connectingFrom.handleType === 'target')
            ) {
                return true;
            }
            // If the connecting from node is the same as the node we're connecting to
            if (connectingFrom.nodeId === id) {
                return false;
            }
            // Any other inputs should be invalid
            if (connectingFrom.handleType === 'target') {
                return false;
            }
            // Show same types
            const connectionIsValid = isValidConnection({
                source: connectingFrom.nodeId,
                sourceHandle: connectingFrom.handleId,
                target: id,
                targetHandle: `${id}-${inputId}`,
            });
            if (connectionIsValid && intersect(connectingFromType, type).type !== 'never') {
                return true;
            }
            return false;
        }, [connectingFrom, connectingFromType, type, id, inputId]);

        const { typeDefinitions, functionDefinitions } = useContext(GlobalContext);
        const { useIsDarkMode } = useContext(SettingsContext);
        const [isDarkMode] = useIsDarkMode;

        let contents = children;
        const handleColors = getTypeAccentColors(type, typeDefinitions, isDarkMode);

        const parentTypeColor = useMemo(() => {
            if (connectedEdge) {
                const parentNode: Node<NodeData> = getNode(connectedEdge.source)! as Node<NodeData>;
                const parentInOutId = parseHandle(connectedEdge.sourceHandle!).inOutId;
                const parentType = functionDefinitions
                    .get(parentNode.data.schemaId)!
                    .outputDefaults.get(parentInOutId)!;
                return getTypeAccentColors(parentType, typeDefinitions, isDarkMode)[0];
            }
            return null;
        }, [connectedEdge, typeDefinitions, functionDefinitions, getNode, isDarkMode]);

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
                <HStack
                    h="full"
                    sx={{
                        '.react-flow__handle-connecting': {
                            opacity: showHandle ? 1 : 0,
                        },
                        '.react-flow__handle-valid': {},
                    }}
                >
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
                            id={`${id}-${inputId}`}
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
