import { Type } from '@chainner/navi';
import { Box, Center, HStack, Text } from '@chakra-ui/react';
import React, { memo, useCallback, useMemo } from 'react';
import { Connection } from 'reactflow';
import { useContext } from 'use-context-selector';
import { Output } from '../../../common/common-types';
import { stringifySourceHandle } from '../../../common/util';
import { VALID, invalid } from '../../../common/Validity';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { getTypeAccentColors } from '../../helpers/accentColors';
import { Handle } from '../Handle';
import { TypeTags } from '../TypeTag';

interface OutputContainerProps {
    output: Output;
    id: string;
    definitionType: Type;
    type: Type | undefined;
    generic: boolean;
    isConnected: boolean;
    useFakeHandles: boolean;
}

export const OutputContainer = memo(
    ({
        children,
        output,
        id,
        definitionType,
        type,
        generic,
        isConnected,
        useFakeHandles,
    }: React.PropsWithChildren<OutputContainerProps>) => {
        const { isValidConnection, useConnectingFrom } = useContext(GlobalVolatileContext);
        const [connectingFrom] = useConnectingFrom;

        const isValidConnectionForRf = useCallback(
            (connection: Readonly<Connection>): boolean => {
                return isValidConnection(connection).isValid;
            },
            [isValidConnection]
        );

        const sourceHandle = stringifySourceHandle({ nodeId: id, outputId: output.id });

        const validity = useMemo(() => {
            // no active connection
            if (!connectingFrom) return VALID;

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
        }, [connectingFrom, id, sourceHandle, isValidConnection]);

        let contents = children;
        if (output.hasHandle) {
            const handleColors = getTypeAccentColors(type || definitionType);
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
                            id={sourceHandle}
                            isValidConnection={isValidConnectionForRf}
                            type="output"
                            useFakeHandles={useFakeHandles}
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
                            display={output.label ? 'block' : 'none'}
                            fontSize="xs"
                            lineHeight="0.9rem"
                            textAlign="center"
                        >
                            {output.label}
                        </Text>
                    </Center>
                )}
                <Box pb={generic ? 0 : 1}>{contents}</Box>
            </Box>
        );
    }
);
