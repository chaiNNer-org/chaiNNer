import { Type } from '@chainner/navi';
import { Box, Center, HStack, Text } from '@chakra-ui/react';
import React, { memo, useCallback, useMemo } from 'react';
import { Connection, Node, useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { InputId, NodeData } from '../../../common/common-types';
import { parseSourceHandle, parseTargetHandle, stringifyTargetHandle } from '../../../common/util';
import { VALID, invalid } from '../../../common/Validity';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { defaultColor, getTypeAccentColors } from '../../helpers/accentColors';
import { Handle } from '../Handle';
import { TypeTag } from '../TypeTag';

export interface HandleWrapperProps {
    id: string;
    inputId: InputId;
    connectableType: Type;
}

export const HandleWrapper = memo(
    ({ children, id, inputId, connectableType }: React.PropsWithChildren<HandleWrapperProps>) => {
        const { isValidConnection, edgeChanges, useConnectingFrom, typeState } =
            useContext(GlobalVolatileContext);
        const { getEdges, getNode } = useReactFlow();

        const connectedEdge = useMemo(() => {
            return getEdges().find(
                (e) => e.target === id && parseTargetHandle(e.targetHandle!).inputId === inputId
            );
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [edgeChanges, getEdges, id, inputId]);
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

        const handleColors = getTypeAccentColors(connectableType);

        const sourceTypeColor = useMemo(() => {
            if (connectedEdge) {
                const sourceNode: Node<NodeData> | undefined = getNode(connectedEdge.source);
                const sourceOutputId = parseSourceHandle(connectedEdge.sourceHandle!).outputId;
                if (sourceNode) {
                    const sourceDef = functionDefinitions.get(sourceNode.data.schemaId);
                    if (!sourceDef) {
                        return defaultColor;
                    }
                    const sourceType =
                        typeState.functions.get(sourceNode.id)?.outputs.get(sourceOutputId) ??
                        sourceDef.outputDefaults.get(sourceOutputId);
                    if (!sourceType) {
                        return defaultColor;
                    }
                    return getTypeAccentColors(sourceType)[0];
                }
                return defaultColor;
            }
            return null;
        }, [connectedEdge, functionDefinitions, typeState, getNode]);

        return (
            <HStack h="full">
                <Center
                    className="chainner-handle"
                    left="-6px"
                    position="absolute"
                >
                    <Handle
                        connectedColor={
                            isConnected ? sourceTypeColor ?? handleColors[0] : undefined
                        }
                        handleColors={handleColors}
                        id={targetHandle}
                        isValidConnection={isValidConnectionForRf}
                        type="input"
                        validity={validity}
                    />
                </Center>
                {children}
            </HStack>
        );
    }
);

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface InputContainerProps {}

export const InputContainer = memo(({ children }: React.PropsWithChildren<InputContainerProps>) => {
    return (
        <Box
            bg="var(--bg-700)"
            h="auto"
            ml={0}
            mr="auto"
            px={2}
            verticalAlign="middle"
            w="full"
        >
            {children}
        </Box>
    );
});

interface WithLabelProps {
    input: {
        readonly label: string;
        readonly optional: boolean;
    };
}

export const WithLabel = memo(
    ({ input: { label, optional }, children }: React.PropsWithChildren<WithLabelProps>) => {
        return (
            <Box
                className="with-label"
                w="full"
            >
                <Center
                    h="1.25rem"
                    px={1}
                    py={0.5}
                    verticalAlign="middle"
                >
                    <Text
                        fontSize="xs"
                        lineHeight="0.9rem"
                        textAlign="center"
                    >
                        {label}
                    </Text>
                    {optional && (
                        <Center
                            h="1rem"
                            verticalAlign="middle"
                        >
                            <TypeTag isOptional>optional</TypeTag>
                        </Center>
                    )}
                </Center>
                <Box pb={1}>{children}</Box>
            </Box>
        );
    }
);

export const WithoutLabel = memo(
    ({ children }: React.PropsWithChildren<Record<string, unknown>>) => {
        return (
            <Box
                className="without-label"
                py={1}
                w="full"
            >
                {children}
            </Box>
        );
    }
);
