import { Type } from '@chainner/navi';
import { Box, Center, HStack, Text } from '@chakra-ui/react';
import React, { memo, useCallback, useMemo } from 'react';
import { Connection } from 'reactflow';
import { useContext } from 'use-context-selector';
import { Output, OutputId } from '../../../common/common-types';
import { stringifySourceHandle } from '../../../common/util';
import { VALID, invalid } from '../../../common/Validity';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { useTypeColor } from '../../hooks/useTypeColor';
import { Handle } from '../Handle';
import { TypeTags } from '../TypeTag';

export interface OutputHandleProps {
    id: string;
    outputId: OutputId;
    definitionType: Type;
    type: Type | undefined;
    isConnected: boolean;
    isIterated: boolean;
}

export const OutputHandle = memo(
    ({ id, outputId, isIterated, definitionType, type, isConnected }: OutputHandleProps) => {
        const { isValidConnection, useConnectingFrom } = useContext(GlobalVolatileContext);
        const [connectingFrom] = useConnectingFrom;

        const isValidConnectionForRf = useCallback(
            (connection: Readonly<Connection>): boolean => {
                return isValidConnection(connection).isValid;
            },
            [isValidConnection]
        );

        const sourceHandle = stringifySourceHandle({ nodeId: id, outputId });

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

        const handleColors = useTypeColor(type || definitionType);

        return (
            <Center
                position="absolute"
                right="-6px"
            >
                <Handle
                    connectedColor={isConnected ? handleColors : undefined}
                    handleColors={handleColors}
                    id={sourceHandle}
                    isIterated={isIterated}
                    isValidConnection={isValidConnectionForRf}
                    type="output"
                    validity={validity}
                />
            </Center>
        );
    }
);

interface OutputContainerProps {
    output: Output;
    id: string;
    definitionType: Type;
    type: Type | undefined;
    generic: boolean;
    isConnected: boolean;
    isIterated: boolean;
    sequenceType?: Type;
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
        isIterated,
        sequenceType,
    }: React.PropsWithChildren<OutputContainerProps>) => {
        let contents = children;
        if (output.hasHandle) {
            contents = (
                <HStack h="full">
                    {children}
                    <OutputHandle
                        definitionType={definitionType}
                        id={id}
                        isConnected={isConnected}
                        isIterated={isIterated}
                        outputId={output.id}
                        type={type}
                    />
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
                                    sequenceType={sequenceType}
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
