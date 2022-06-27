import { Box, HStack, Text, chakra, useColorModeValue, useToken } from '@chakra-ui/react';
import React, { memo, useMemo } from 'react';
import { Connection, Handle, Node, Position, useReactFlow } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { NodeData, SchemaId } from '../../../common/common-types';
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
    schemaId: SchemaId;
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
        schemaId,
    }: React.PropsWithChildren<InputContainerProps>) => {
        const { isValidConnection, edgeChanges } = useContext(GlobalVolatileContext);
        const { getEdges, getNode } = useReactFlow();
        const edges = useMemo(() => getEdges(), [edgeChanges]);
        const connectedEdge = edges.find(
            (e) => e.target === id && parseHandle(e.targetHandle!).inOutId === inputId
        );
        const isConnected = !!connectedEdge;

        const { typeDefinitions, functionDefinitions } = useContext(GlobalContext);
        const { useIsDarkMode } = useContext(SettingsContext);
        const [isDarkMode] = useIsDarkMode;

        let contents = children;
        const handleColors = getTypeAccentColors(type, typeDefinitions, isDarkMode); // useColorModeValue('#EDF2F7', '#171923');

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

        const borderColor = useColorModeValue('#171923', '#F7FAFC'); // shadeColor(handleColor, 25); // useColorModeValue('#171923', '#F7FAFC');
        const connectedColor = useColorModeValue('#EDF2F7', '#171923');
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
                        <Div
                            _before={{
                                content: '" "',
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                height: '35px',
                                width: '45px',
                                cursor: 'crosshair',
                                // backgroundColor: '#FF00FF1F',
                                transform: 'translate(-50%, -50%)',
                                borderRadius: '100%',
                            }}
                            _hover={{
                                width: '22px',
                                height: '22px',
                                marginLeft: '-3px',
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
                                borderImageSlice: 1,
                            }}
                            onContextMenu={noContextMenu}
                        >
                            {/* // TODO: This would be for icons, if the time ever comes */}
                            {/* <Center
                                h="full"
                                w="full"
                            >
                                <CloseIcon boxSize={2} />
                            </Center> */}
                        </Div>
                    </div>
                    {children}
                </HStack>
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const [gray300, gray700]: string[] = useToken('colors', ['gray.300', 'gray.700']);

        const bgColor = useColorModeValue(gray300, gray700);

        return (
            <Box
                // bg={useColorModeValue('gray.100', 'gray.600')}
                // bg={interpolateColor(accentColor, bgColor, 0.95)}
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
