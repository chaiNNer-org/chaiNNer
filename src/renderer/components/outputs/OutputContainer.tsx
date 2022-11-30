import { Type } from '@chainner/navi';
import { Box, Center, HStack, Text, Tooltip, chakra } from '@chakra-ui/react';
import React, { memo, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Connection, Handle, Position, useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { OutputId } from '../../../common/common-types';
import { parseSourceHandle, stringifySourceHandle } from '../../../common/util';
import { VALID, Validity, invalid } from '../../../common/Validity';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { getTypeAccentColors } from '../../helpers/getTypeAccentColors';
import { noContextMenu } from '../../hooks/useContextMenu';
import { TypeTags } from '../TypeTag';

interface OutputContainerProps {
    hasHandle: boolean;
    outputId: OutputId;
    id: string;
    definitionType: Type;
    label: string;
    generic: boolean;
    index: number;
    length: number;
}

interface RightHandleProps {
    isValidConnection: (connection: Readonly<Connection>) => boolean;
    validity: Validity;
}

// Had to do this garbage to prevent chakra from clashing the position prop
const RightHandle = memo(
    ({
        children,
        isValidConnection,
        validity,
        ...props
    }: React.PropsWithChildren<RightHandleProps>) => (
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
                className="output-handle"
                isValidConnection={isValidConnection}
                position={Position.Right}
                type="source"
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

export const OutputContainer = memo(
    ({
        children,
        hasHandle,
        outputId,
        id,
        definitionType,
        label,
        generic,
        index,
        length,
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
        const [handleColor] = getTypeAccentColors(type || definitionType);
        const connectedColor = 'var(--connection-color)';
        if (hasHandle) {
            contents = (
                <HStack h="full">
                    {children}
                    <Center
                        position="absolute"
                        right="-6px"
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
                                marginRight: '-3px',
                                opacity: validity.isValid ? 1 : 0,
                            }}
                            as={RightHandle}
                            className="output-handle"
                            id={stringifySourceHandle({ nodeId: id, outputId })}
                            isValidConnection={isValidConnectionForRf}
                            sx={{
                                width: '16px',
                                height: '16px',
                                borderWidth: '2px',
                                borderColor: handleColor,
                                transition: '0.15s ease-in-out',
                                background: isConnected ? connectedColor : handleColor,
                                boxShadow: '-2px 2px 2px #00000014',
                                filter: validity.isValid ? undefined : 'grayscale(100%)',
                                opacity: validity.isValid ? 1 : 0.3,
                                position: 'relative',
                            }}
                            validity={validity}
                            onContextMenu={noContextMenu}
                        />
                    </Center>
                </HStack>
            );
        }

        return (
            <Box
                bg="var(--gray-775)"
                borderBottomLeftRadius={index === length - 1 ? 'lg' : 0}
                borderTopLeftRadius={index === 0 ? 'lg' : 0}
                w="full"
            >
                <Box
                    bg="var(--gray-700)"
                    borderBottomLeftRadius={index === length - 1 ? 'lg' : 0}
                    borderTopLeftRadius={index === 0 ? 'lg' : 0}
                    h="auto"
                    minH="2rem"
                    ml="auto"
                    mr={0}
                    px={2}
                    verticalAlign="middle"
                    w="calc(100% - 0.5rem)"
                >
                    {!generic && (
                        <Center
                            h="1.25rem"
                            p={1}
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
                    <Box pb={generic ? 0 : 2}>{contents}</Box>
                </Box>
            </Box>
        );
    }
);
