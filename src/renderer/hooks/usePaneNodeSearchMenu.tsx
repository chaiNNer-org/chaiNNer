import { CloseIcon, SearchIcon } from '@chakra-ui/icons';
import {
    Box,
    HStack,
    Input,
    InputGroup,
    InputLeftElement,
    InputRightElement,
    MenuList,
    Text,
    useColorModeValue,
} from '@chakra-ui/react';
import log from 'electron-log';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Node, OnConnectStartParams, useReactFlow } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { NodeData, NodeSchema } from '../../common/common-types';
import { createUniqueId, parseHandle } from '../../common/util';
import { IconFactory } from '../components/CustomIcons';
import { ContextMenuContext } from '../contexts/ContextMenuContext';
import { GlobalContext, GlobalVolatileContext, NodeProto } from '../contexts/GlobalNodeState';
import getNodeAccentColors from '../helpers/getNodeAccentColors';
import { getMatchingNodes, getNodesByCategory } from '../helpers/nodeSearchFuncs';
import { useContextMenu } from './useContextMenu';

interface UsePaneNodeSearchMenuValue {
    readonly onConnectStart: (event: React.MouseEvent, handle: OnConnectStartParams) => void;
    readonly onConnectStop: (event: MouseEvent) => void;
    readonly onPaneContextMenu: (event: React.MouseEvent) => void;
}

interface Position {
    readonly x: number;
    readonly y: number;
}

export const usePaneNodeSearchMenu = (
    wrapperRef: React.RefObject<HTMLDivElement>
): UsePaneNodeSearchMenuValue => {
    const { createNode, createConnection } = useContext(GlobalVolatileContext);
    const { closeContextMenu } = useContext(ContextMenuContext);
    const { schemata } = useContext(GlobalContext);

    const [connectingFrom, setConnectingFrom] = useState<OnConnectStartParams | null>(null);
    const [connectingFromType, setConnectingFromType] = useState<string | null>(null);
    const [isStoppedOnPane, setIsStoppedOnPane] = useState(false);
    const { getNode, project } = useReactFlow();

    const [mousePosition, setMousePosition] = useState<Position>({ x: 0, y: 0 });

    const [searchQuery, setSearchQuery] = useState('');
    const matchingNodes = useMemo(
        () =>
            getMatchingNodes(searchQuery, schemata.schemata).filter((node) => {
                if (!connectingFrom || !connectingFromType) {
                    return true;
                }
                if (connectingFrom.handleType === 'source') {
                    return node.inputs.some((input) => {
                        return connectingFromType === input.type && input.hasHandle;
                    });
                }
                if (connectingFrom.handleType === 'target') {
                    return node.outputs.some((output) => {
                        return connectingFromType === output.type;
                    });
                }
                log.error(`Unknown handle type: ${connectingFrom.handleType!}`);
                return true;
            }),
        [connectingFrom, connectingFromType, searchQuery, schemata.schemata]
    );
    const byCategories = useMemo(() => getNodesByCategory(matchingNodes), [matchingNodes]);

    useEffect(() => {
        setSearchQuery('');
    }, [connectingFrom]);

    const onPaneContextMenuNodeClick = useCallback(
        (node: NodeSchema, position: Position) => {
            const reactFlowBounds = wrapperRef.current!.getBoundingClientRect();
            const { x, y } = position;
            const projPosition = project({
                x: x - reactFlowBounds.left,
                y: y - reactFlowBounds.top,
            });
            const nodeId = createUniqueId();
            const nodeToMake: NodeProto = {
                id: nodeId,
                position: projPosition,
                data: {
                    schemaId: node.schemaId,
                },
                nodeType: node.nodeType,
            };
            createNode(nodeToMake);
            if (isStoppedOnPane && connectingFrom) {
                if (connectingFrom.handleType === 'source') {
                    const firstValidHandle = schemata
                        .get(node.schemaId)
                        .inputs.find(
                            (input) => input.type === connectingFromType && input.hasHandle
                        );
                    if (firstValidHandle) {
                        createConnection({
                            source: connectingFrom.nodeId,
                            sourceHandle: connectingFrom.handleId,
                            target: nodeId,
                            targetHandle: `${nodeId}-${firstValidHandle.id}`,
                        });
                    }
                } else if (connectingFrom.handleType === 'target') {
                    const firstValidHandle = schemata
                        .get(node.schemaId)
                        .outputs.find((output) => output.type === connectingFromType);
                    if (firstValidHandle) {
                        createConnection({
                            source: nodeId,
                            sourceHandle: `${nodeId}-${firstValidHandle.id}`,
                            target: connectingFrom.nodeId,
                            targetHandle: connectingFrom.handleId,
                        });
                    }
                } else {
                    log.error(`Unknown handle type: ${connectingFrom.handleType!}`);
                }
            }

            setConnectingFrom(null);
            closeContextMenu();
        },
        [
            connectingFrom,
            createConnection,
            createNode,
            schemata,
            connectingFromType,
            isStoppedOnPane,
        ]
    );

    const bgColor = useColorModeValue('gray.300', 'gray.700');

    const menu = useContextMenu(
        () => (
            <MenuList
                bgColor={useColorModeValue('gray.200', 'gray.800')}
                borderWidth={0}
                className="nodrag"
            >
                <InputGroup
                    borderBottomWidth={1}
                    borderRadius={0}
                >
                    <InputLeftElement
                        color={useColorModeValue('gray.500', 'gray.300')}
                        pointerEvents="none"
                    >
                        <SearchIcon />
                    </InputLeftElement>
                    <Input
                        autoFocus
                        borderRadius={0}
                        placeholder="Search..."
                        spellCheck={false}
                        type="text"
                        value={searchQuery}
                        variant="filled"
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <InputRightElement
                        _hover={{ color: useColorModeValue('black', 'white') }}
                        style={{
                            color: useColorModeValue('gray.500', 'gray.300'),
                            cursor: 'pointer',
                            display: searchQuery ? undefined : 'none',
                            fontSize: '66%',
                        }}
                        onClick={() => setSearchQuery('')}
                    >
                        <CloseIcon />
                    </InputRightElement>
                </InputGroup>
                <Box
                    h="auto"
                    maxH={400}
                    overflowY="scroll"
                    p={1}
                >
                    {[...byCategories].map(([category, categoryNodes]) => {
                        const accentColor = getNodeAccentColors(category);
                        return (
                            <Box key={category}>
                                <HStack
                                    borderRadius="md"
                                    mx={1}
                                    py={0.5}
                                >
                                    <IconFactory
                                        accentColor={accentColor}
                                        boxSize={3}
                                        icon={category}
                                    />
                                    <Text fontSize="xs">{category}</Text>
                                </HStack>
                                {[...categoryNodes].map((node) => (
                                    <HStack
                                        _hover={{
                                            backgroundColor: bgColor,
                                        }}
                                        borderRadius="md"
                                        key={node.schemaId}
                                        mx={1}
                                        px={2}
                                        py={0.5}
                                        onClick={() => {
                                            setSearchQuery('');
                                            onPaneContextMenuNodeClick(node, mousePosition);
                                        }}
                                    >
                                        <IconFactory
                                            accentColor="gray.500"
                                            icon={node.icon}
                                        />
                                        <Text>{node.name}</Text>
                                    </HStack>
                                ))}
                            </Box>
                        );
                    })}
                </Box>
            </MenuList>
        ),
        [
            connectingFrom,
            connectingFromType,
            byCategories,
            onPaneContextMenuNodeClick,
            searchQuery,
            schemata.schemata,
            matchingNodes,
            mousePosition,
        ]
    );

    useEffect(() => {
        if (connectingFrom) {
            const { nodeId, inOutId } = parseHandle(connectingFrom.handleId!);
            const node: Node<NodeData> | undefined = getNode(nodeId);
            if (node) {
                const nodeSchema = schemata.get(node.data.schemaId);
                if (connectingFrom.handleType === 'source') {
                    const outputType = nodeSchema.outputs[inOutId]?.type;
                    setConnectingFromType(outputType);
                } else if (connectingFrom.handleType === 'target') {
                    const inputType = nodeSchema.inputs[inOutId]?.type;
                    setConnectingFromType(inputType);
                } else {
                    log.error(`Unknown handle type: ${connectingFrom.handleType!}`);
                }
            }
        }
    }, [connectingFrom]);

    const onConnectStart = useCallback(
        (event: React.MouseEvent, handle: OnConnectStartParams) => {
            setMousePosition({
                x: event.pageX,
                y: event.pageY,
            });
            setIsStoppedOnPane(false);
            setConnectingFrom(handle);
        },
        [setConnectingFrom, setIsStoppedOnPane]
    );

    const [coordinates, setCoordinates] = useState<Position>({ x: 0, y: 0 });

    const onConnectStop = useCallback(
        (event: MouseEvent) => {
            setIsStoppedOnPane(
                (event.ctrlKey || event.metaKey) &&
                    String((event.target as Element).className).includes('pane')
            );
            setMousePosition({
                x: event.pageX,
                y: event.pageY,
            });
            setCoordinates({
                x: event.pageX,
                y: event.pageY,
            });
        },
        [setCoordinates, setIsStoppedOnPane]
    );

    const onPaneContextMenu = useCallback(
        (event: React.MouseEvent) => {
            setMousePosition({
                x: event.pageX,
                y: event.pageY,
            });
            setConnectingFrom(null);
            setSearchQuery('');
            menu.onContextMenu(event);
        },
        [setConnectingFrom, menu, setMousePosition, setSearchQuery]
    );

    useEffect(() => {
        if (isStoppedOnPane && connectingFrom) {
            const { x, y } = coordinates;
            menu.manuallyOpenContextMenu(x, y);
        }
    }, [isStoppedOnPane, connectingFrom]);

    return { onConnectStart, onConnectStop, onPaneContextMenu };
};
