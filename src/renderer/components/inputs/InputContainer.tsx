import { Type } from '@chainner/navi';
import { QuestionIcon } from '@chakra-ui/icons';
import { Box, Center, HStack, Text, Tooltip } from '@chakra-ui/react';
import React, { memo, useCallback, useMemo } from 'react';
import { Connection, Node, useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { InputId, LabelStyle, NodeData } from '../../../common/common-types';
import {
    assertNever,
    parseSourceHandle,
    parseTargetHandle,
    stringifyTargetHandle,
} from '../../../common/util';
import { VALID, invalid } from '../../../common/Validity';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { InputContext } from '../../contexts/InputContext';
import { defaultColor, getTypeAccentColors } from '../../helpers/accentColors';
import { Handle } from '../Handle';
import { Markdown } from '../Markdown';
import { TypeTag } from '../TypeTag';

export interface InputHandleProps {
    id: string;
    inputId: InputId;
    connectableType: Type;
    isIterated: boolean;
}

export const InputHandle = memo(
    ({
        children,
        id,
        inputId,
        connectableType,
        isIterated,
    }: React.PropsWithChildren<InputHandleProps>) => {
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
            <HStack
                h="full"
                pl={2}
                spacing={0}
            >
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
                        isIterated={isIterated}
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
        readonly hint?: boolean;
        readonly description?: string;
        readonly hasHandle?: boolean;
    };
}

export const WithLabel = memo(
    ({
        input: { label, optional, hint, description },
        children,
    }: React.PropsWithChildren<WithLabelProps>) => {
        const { conditionallyInactive } = useContext(InputContext);

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
                    <Tooltip
                        hasArrow
                        borderRadius={8}
                        label={
                            hint ? (
                                <Markdown nonInteractive>{description ?? ''}</Markdown>
                            ) : undefined
                        }
                        openDelay={500}
                        px={2}
                        py={1}
                    >
                        <HStack
                            m={0}
                            p={0}
                            spacing={0}
                        >
                            <Text
                                fontSize="xs"
                                lineHeight="0.9rem"
                                opacity={conditionallyInactive ? 0.7 : undefined}
                                textAlign="center"
                                textDecoration={conditionallyInactive ? 'line-through' : undefined}
                            >
                                {label}
                            </Text>
                            {hint && (
                                <Center
                                    h="auto"
                                    m={0}
                                    p={0}
                                >
                                    <QuestionIcon
                                        boxSize={3}
                                        ml={1}
                                    />
                                </Center>
                            )}
                            {optional && (
                                <Center
                                    h="1rem"
                                    verticalAlign="middle"
                                >
                                    <TypeTag isOptional>optional</TypeTag>
                                </Center>
                            )}
                        </HStack>
                    </Tooltip>
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

export const InlineLabel = memo(({ input, children }: React.PropsWithChildren<WithLabelProps>) => {
    const { conditionallyInactive } = useContext(InputContext);

    const hasHandle = input.hasHandle ?? false;

    return (
        <WithoutLabel>
            <HStack
                pl={hasHandle ? 0 : 2}
                spacing={0}
            >
                <Box
                    display="flex"
                    flexDirection="row"
                    flexShrink={0}
                    w="5.4em"
                >
                    <Text
                        opacity={conditionallyInactive ? 0.7 : undefined}
                        textDecoration={conditionallyInactive ? 'line-through' : undefined}
                    >
                        {input.label}
                    </Text>
                    {/* <Center>
                <TypeTags
                    isOptional={input.optional}
                    type={definitionType}
                />
            </Center> */}
                </Box>

                <Box flexGrow={1}>{children}</Box>
            </HStack>
        </WithoutLabel>
    );
});

interface AutoLabelProps {
    input: WithLabelProps['input'] & { labelStyle: LabelStyle | undefined };
}

export const AutoLabel = memo(({ input, children }: React.PropsWithChildren<AutoLabelProps>) => {
    switch (input.labelStyle) {
        case 'hidden':
            return <WithoutLabel>{children}</WithoutLabel>;
        case 'inline':
            return <InlineLabel input={input}>{children}</InlineLabel>;
        case 'default':
        case undefined:
            return <WithLabel input={input}>{children}</WithLabel>;
        default:
            return assertNever(input.labelStyle);
    }
});
