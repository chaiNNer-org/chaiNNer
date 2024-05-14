import { Type } from '@chainner/navi';
import { QuestionIcon } from '@chakra-ui/icons';
import { Box, Center, HStack, Text, Tooltip } from '@chakra-ui/react';
import React, { memo, useCallback, useMemo } from 'react';
import { Connection } from 'reactflow';
import { useContext } from 'use-context-selector';
import { InputId, LabelStyle } from '../../../common/common-types';
import { assertNever, stringifyTargetHandle } from '../../../common/util';
import { VALID, invalid } from '../../../common/Validity';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { InputContext } from '../../contexts/InputContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getTypeAccentColors } from '../../helpers/accentColors';
import { useSourceTypeColor } from '../../hooks/useSourceTypeColor';
import { Handle } from '../Handle';
import { Markdown } from '../Markdown';
import { TypeTag } from '../TypeTag';

export interface InputHandleProps {
    id: string;
    inputId: InputId;
    connectableType: Type;
    isIterated: boolean;
    isConnected: boolean;
}

export const InputHandle = memo(
    ({
        children,
        id,
        inputId,
        connectableType,
        isIterated,
        isConnected,
    }: React.PropsWithChildren<InputHandleProps>) => {
        const { isValidConnection, useConnectingFrom } = useContext(GlobalVolatileContext);
        const { theme } = useSettings();
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

        const handleColors = useMemo(
            () => getTypeAccentColors(connectableType),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [connectableType, theme]
        );

        const sourceTypeColor = useSourceTypeColor(targetHandle);

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

export interface InputContainerProps {
    passthroughIgnored: boolean;
}

export const InputContainer = memo(
    ({ children, passthroughIgnored }: React.PropsWithChildren<InputContainerProps>) => {
        if (passthroughIgnored) {
            // eslint-disable-next-line no-param-reassign
            children = <Box opacity="50%">{children}</Box>;
        }

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
    }
);

interface WithLabelProps {
    input: {
        readonly label: string;
        readonly optional?: boolean;
        readonly hint?: boolean;
        readonly description?: string;
        readonly hasHandle?: boolean;
    };
}

export const WithLabel = memo(({ input, children }: React.PropsWithChildren<WithLabelProps>) => {
    const { conditionallyInactive } = useContext(InputContext);

    const { label, optional = false, hint = false, description } = input;

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
                        hint ? <Markdown nonInteractive>{description ?? ''}</Markdown> : undefined
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
});

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

    const { hasHandle = false, hint = false, description } = input;

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
                    {hint && description && (
                        <Tooltip
                            hasArrow
                            borderRadius={8}
                            label={<Markdown nonInteractive>{description}</Markdown>}
                            openDelay={500}
                            px={2}
                            py={1}
                        >
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
                        </Tooltip>
                    )}
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
