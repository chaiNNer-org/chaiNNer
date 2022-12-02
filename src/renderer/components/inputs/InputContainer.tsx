import { Type } from '@chainner/navi';
import { Box, Center, HStack, Text, Tooltip, chakra } from '@chakra-ui/react';
import React, { memo, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Connection, Handle, Node, Position, useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { InputId, NodeData } from '../../../common/common-types';
import { parseSourceHandle, parseTargetHandle, stringifyTargetHandle } from '../../../common/util';
import { VALID, Validity, invalid } from '../../../common/Validity';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { defaultColor, getTypeAccentColors } from '../../helpers/getTypeAccentColors';
import { noContextMenu } from '../../hooks/useContextMenu';
import { TypeTag } from '../TypeTag';

interface LeftHandleProps {
    isValidConnection: (connection: Readonly<Connection>) => boolean;
    validity: Validity;
}

// Had to do this garbage to prevent chakra from clashing the position prop
const LeftHandle = memo(
    ({
        children,
        isValidConnection,
        validity,
        ...props
    }: React.PropsWithChildren<LeftHandleProps>) => (
        <Tooltip
            hasArrow
            borderRadius={8}
            display={validity.isValid ? 'none' : 'block'}
            label={
                validity.isValid ? undefined : (
                    <ReactMarkdown>{`Unable to connect: ${validity.reason}`}</ReactMarkdown>
                )
            }
            mt={1}
            opacity={validity.isValid ? 0 : 1}
            openDelay={500}
            px={2}
            py={1}
        >
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
        </Tooltip>
    )
);

const Div = chakra('div', {
    baseStyle: {},
});

export interface HandleWrapperProps {
    id: string;
    inputId: InputId;
    definitionType: Type;
}

export const HandleWrapper = memo(
    ({ children, id, inputId, definitionType }: React.PropsWithChildren<HandleWrapperProps>) => {
        const { isValidConnection, edgeChanges, useConnectingFrom, typeState } =
            useContext(GlobalVolatileContext);
        const { getEdges, getNode } = useReactFlow();
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const edges = useMemo(() => getEdges(), [edgeChanges, getEdges]);
        const connectedEdge = edges.find(
            (e) => e.target === id && parseTargetHandle(e.targetHandle!).inputId === inputId
        );
        const isConnected = !!connectedEdge;
        const [connectingFrom] = useConnectingFrom;

        const targetHandle = stringifyTargetHandle({ nodeId: id, inputId });

        const isValidConnectionForRf = useCallback(
            (connection: Readonly<Connection>): boolean => {
                return isValidConnection(connection).isValid;
            },
            [isValidConnection]
        );

        const validity = useMemo(() => {
            // no active connection
            if (!connectingFrom) return VALID;

            // We only want to display the connectingFrom target handle
            if (connectingFrom.handleType === 'target') {
                return connectingFrom.handleId === targetHandle
                    ? VALID
                    : invalid('Cannot create an input-to-input connection');
            }

            // Show same types
            return isValidConnection({
                source: connectingFrom.nodeId,
                sourceHandle: connectingFrom.handleId,
                target: id,
                targetHandle,
            });
        }, [connectingFrom, id, targetHandle, isValidConnection]);

        const { functionDefinitions } = useContext(BackendContext);

        const handleColors = getTypeAccentColors(definitionType);

        const parentTypeColor = useMemo(() => {
            if (connectedEdge) {
                const parentNode: Node<NodeData> | undefined = getNode(connectedEdge.source);
                const parentOutputId = parseSourceHandle(connectedEdge.sourceHandle!).outputId;
                if (parentNode) {
                    const parentDef = functionDefinitions.get(parentNode.data.schemaId);
                    if (!parentDef) {
                        return defaultColor;
                    }
                    const parentType =
                        typeState.functions.get(parentNode.id)?.outputs.get(parentOutputId) ??
                        parentDef.outputDefaults.get(parentOutputId);
                    if (!parentType) {
                        return defaultColor;
                    }
                    return getTypeAccentColors(parentType)[0];
                }
                return defaultColor;
            }
            return null;
        }, [connectedEdge, functionDefinitions, typeState, getNode]);

        // A conic gradient that uses all handle colors to give an even distribution of colors
        const handleColorString = handleColors
            .map((color, index) => {
                const percent = index / handleColors.length;
                const nextPercent = (index + 1) / handleColors.length;
                return `${color} ${percent * 100}% ${nextPercent * 100}%`;
            })
            .join(', ');
        const handleGradient = `conic-gradient(from 90deg, ${handleColorString})`;
        const connectedColor = 'var(--connection-color)';

        return (
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
                            height: '45px',
                            width: '45px',
                            cursor: 'crosshair',
                            transform: 'translate(-50%, -50%)',
                            borderRadius: '100%',
                        }}
                        _hover={{
                            width: '22px',
                            height: '22px',
                            marginLeft: '-3px',
                            opacity: validity.isValid ? 1 : 0,
                        }}
                        as={LeftHandle}
                        className="input-handle"
                        id={targetHandle}
                        isValidConnection={isValidConnectionForRf}
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
                            filter: validity.isValid ? undefined : 'grayscale(100%)',
                            opacity: validity.isValid ? 1 : 0.3,
                            position: 'relative',
                        }}
                        validity={validity}
                        onContextMenu={noContextMenu}
                    />
                </Center>
                {children}
            </HStack>
        );
    }
);

export interface InputContainerProps {
    label?: string;
    optional: boolean;
    generic: boolean;
}

export const InputContainer = memo(
    ({ children, label, optional, generic }: React.PropsWithChildren<InputContainerProps>) => {
        return (
            <Box
                bg="var(--bg-700)"
                h="auto"
                minH="2rem"
                ml={0}
                mr="auto"
                px={2}
                verticalAlign="middle"
                w="full"
            >
                {!generic && (
                    <Center
                        h="1.25rem"
                        px={1}
                        py={0.5}
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
                <Box pb={generic ? 0 : 1}>{children}</Box>
            </Box>
        );
    }
);
