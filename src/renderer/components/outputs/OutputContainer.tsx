import { Type } from '@chainner/navi';
import { Box, Center, HStack, Text } from '@chakra-ui/react';
import React, { memo, useCallback, useMemo } from 'react';
import { Connection, useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { OutputId } from '../../../common/common-types';
import { parseSourceHandle, stringifySourceHandle } from '../../../common/util';
import { VALID, invalid } from '../../../common/Validity';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { getTypeAccentColors } from '../../helpers/accentColors';
import { Handle } from '../Handle';
import { TypeTags } from '../TypeTag';

interface OutputContainerProps {
    hasHandle: boolean;
    outputId: OutputId;
    id: string;
    definitionType: Type;
    label: string;
    generic: boolean;
}

export const OutputContainer = memo(
    ({
        children,
        hasHandle,
        outputId,
        id,
        definitionType,
        label,
        generic,
    }: React.PropsWithChildren<OutputContainerProps>) => {
        const { isValidConnection, edgeChanges, useConnectingFrom } =
            useContext(GlobalVolatileContext);

        const { getEdges } = useReactFlow();
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const edges = useMemo(() => getEdges(), [edgeChanges, getEdges]);
        const isConnected = !!edges.find(
            (e) => e.source === id && parseSourceHandle(e.sourceHandle!).outputId === outputId
        );
        const [connectingFrom] = useConnectingFrom;

        const type = useContextSelector(GlobalVolatileContext, (c) =>
            c.typeState.functions.get(id)?.outputs.get(outputId)
        );

        const isValidConnectionForRf = useCallback(
            (connection: Readonly<Connection>): boolean => {
                return isValidConnection(connection).isValid;
            },
            [isValidConnection]
        );

        const validity = useMemo(() => {
            // no active connection
            if (!connectingFrom) return VALID;

            const sourceHandle = stringifySourceHandle({ nodeId: id, outputId });

            // We only want to display the connectingFrom source handle
            if (connectingFrom.handleType === 'source') {
                return connectingFrom.handleId === sourceHandle
                    ? VALID
                    : invalid('Cannot create an output-to-output connection');
            }

            return isValidConnection({
                source: id,
                sourceHandle,
                target: connectingFrom.nodeId,
                targetHandle: connectingFrom.handleId,
            });
        }, [connectingFrom, id, outputId, isValidConnection]);

        let contents = children;
        const handleColors = getTypeAccentColors(type || definitionType);
        if (hasHandle) {
            contents = (
                <HStack h="full">
                    {children}
                    <Center
                        position="absolute"
                        right="-6px"
                    >
                        <Handle
                            connectedColor={isConnected ? handleColors[0] : undefined}
                            handleColors={handleColors}
                            id={stringifySourceHandle({ nodeId: id, outputId })}
                            isValidConnection={isValidConnectionForRf}
                            type="output"
                            validity={validity}
                        />
                    </Center>
                </HStack>
            );
        }

        return (
            <Box
                bg="var(--bg-700)"
                h="auto"
                minH="2rem"
                ml="auto"
                mr={0}
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
                        {type && (
                            <Center
                                h="2rem"
                                mr={1}
                                verticalAlign="middle"
                            >
                                <TypeTags
                                    isOptional={false}
                                    type={type}
                                />
                            </Center>
                        )}
                        <Text
                            display={label ? 'block' : 'none'}
                            fontSize="xs"
                            lineHeight="0.9rem"
                            textAlign="center"
                        >
                            {label}
                        </Text>
                    </Center>
                )}
                <Box pb={generic ? 0 : 1}>{contents}</Box>
            </Box>
        );
    }
);
