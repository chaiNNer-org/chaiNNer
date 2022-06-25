import { CloseIcon, SearchIcon, StarIcon } from '@chakra-ui/icons';
import {
    Box,
    Center,
    HStack,
    Input,
    InputGroup,
    InputLeftElement,
    InputRightElement,
    MenuList,
    Spacer,
    Text,
    useColorModeValue
} from '@chakra-ui/react';
import log from 'electron-log';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Node, OnConnectStartParams, useReactFlow } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { NodeData, NodeSchema } from '../../common/common-types';
import { intersect } from '../../common/types/intersection';
import { Type } from '../../common/types/types';
import { createUniqueId, parseHandle } from '../../common/util';
import { IconFactory } from '../components/CustomIcons';
import { ContextMenuContext } from '../contexts/ContextMenuContext';
import { GlobalContext, GlobalVolatileContext, NodeProto } from '../contexts/GlobalNodeState';
import getNodeAccentColors from '../helpers/getNodeAccentColors';
import { getMatchingNodes, getNodesByCategory } from '../helpers/nodeSearchFuncs';
import { useContextMenu } from './useContextMenu';
import { useNodeFavorites } from './useNodeFavorites';

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
    const { createNode, createConnection, typeState } = useContext(GlobalVolatileContext);
    const { closeContextMenu } = useContext(ContextMenuContext);
    const { schemata, functionDefinitions } = useContext(GlobalContext);

    const [connectingFrom, setConnectingFrom] = useState<OnConnectStartParams | null>(null);
    const [connectingFromType, setConnectingFromType] = useState<Type | null>(null);
    const [isStoppedOnPane, setIsStoppedOnPane] = useState(false);
    const { getNode, project } = useReactFlow();

    const [mousePosition, setMousePosition] = useState<Position>({ x: 0, y: 0 });

    const [searchQuery, setSearchQuery] = useState('');
    const matchingNodes = useMemo(
        () =>
            getMatchingNodes(searchQuery, schemata.schemata).filter((node) => {
                if (
                    !connectingFrom ||
                    !connectingFromType ||
                    !connectingFrom.nodeId ||
                    !connectingFrom.handleId || 
                    !connectingFrom.handleType
                ) {
                    return true;
                }
                if (connectingFrom.handleType === 'source') {
                    const sourceFn = typeState.functions.get(connectingFrom.nodeId);

                    if (!sourceFn) {
                        return false;
                    }

                    const { inOutId } = parseHandle(connectingFrom.handleId);
                    const sourceType = sourceFn.outputs.get(inOutId);

                    if (!sourceType) {
                        return false;
                    }

                    const targetTypes = functionDefinitions.get(node.schemaId);

                    if (!targetTypes) {
                        return false;
                    }

                    return [...targetTypes.inputs].some(([number, type]) => {
                        const overlap = intersect(type, sourceType);
                        return (
                            overlap.type !== 'never' &&
                            schemata.get(node.schemaId).inputs[number].hasHandle
                        );
                    });
                }
                if (connectingFrom.handleType === 'target') {
                    const sourceFn = typeState.functions.get(connectingFrom.nodeId);

                    if (!sourceFn) {
                        return false;
                    }

                    const { inOutId } = parseHandle(connectingFrom.handleId);
                    const sourceType = sourceFn.inputs.get(inOutId);

                    if (!sourceType) {
                        return false;
                    }

                    const targetTypes = functionDefinitions.get(node.schemaId);

                    if (!targetTypes) {
                        return false;
                    }

                    return [...targetTypes.outputDefaults].some(([, type]) => {
                        const overlap = intersect(type, sourceType);
                        return overlap.type !== 'never';
                    });
                }
                log.error(`Unknown handle type: ${connectingFrom.handleType}`);
                return true;
            }),
        [connectingFrom, connectingFromType, searchQuery, schemata.schemata]
    );
    const byCategories = useMemo(() => getNodesByCategory(matchingNodes), [matchingNodes]);

    const { favorites } = useNodeFavorites();

    useEffect(() => {
        setSearchQuery('');
    }, [connectingFrom]);

    const onPaneContextMenuNodeClick = useCallback(
        (schema: NodeSchema, position: Position) => {
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
                    schemaId: schema.schemaId,
                },
                nodeType: schema.nodeType,
            };
            createNode(nodeToMake);
            const targetTypes = functionDefinitions.get(schema.schemaId);
            if (isStoppedOnPane && connectingFrom && targetTypes && connectingFromType && connectingFrom.handleType) {
                if (connectingFrom.handleType === 'source') {
                    const firstPossibleTarget = [...targetTypes.inputs].find(([inputId, type]) => {
                        const overlap = intersect(type, connectingFromType);
                        return (
                            overlap.type !== 'never' &&
                            schemata.get(schema.schemaId).inputs[inputId].hasHandle
                        );
                    });
                    if (firstPossibleTarget) {
                        createConnection({
                            source: connectingFrom.nodeId,
                            sourceHandle: connectingFrom.handleId,
                            target: nodeId,
                            targetHandle: `${nodeId}-${firstPossibleTarget[0]}`,
                        });
                    }
                } else if (connectingFrom.handleType === 'target') {
                    const firstPossibleTarget = [...targetTypes.outputDefaults].find(([, type]) => {
                        const overlap = intersect(type, connectingFromType);
                        return overlap.type !== 'never';
                    });
                    if (firstPossibleTarget) {
                        createConnection({
                            source: nodeId,
                            sourceHandle: `${nodeId}-${firstPossibleTarget[0]}`,
                            target: connectingFrom.nodeId,
                            targetHandle: connectingFrom.handleId,
                        });
                    }
                } else {
                    log.error(`Unknown handle type: ${connectingFrom.handleType}`);
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

    const menu = useContextMenu(() => (
        <MenuList
            bgColor={useColorModeValue('gray.200', 'gray.800')}
            borderWidth={0}
            className="nodrag"
            overflow="hidden"
            onContextMenu={(e) => e.stopPropagation()}
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
                {[...byCategories].length > 0 ? (
                    [...byCategories].map(([category, categoryNodes]) => {
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
                                {[...categoryNodes].map((node) => {
                                    const isFavorite = favorites.has(node.schemaId);
                                    return (
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
                                            <Text
                                                h="full"
                                                verticalAlign="middle"
                                            >
                                                {node.name}
                                            </Text>
                                            (
                                            {isFavorite && (
                                                <>
                                                    <Spacer />
                                                    <StarIcon
                                                        aria-label="Favorites"
                                                        boxSize={2.5}
                                                        color="gray.500"
                                                        overflow="hidden"
                                                        stroke="gray.500"
                                                        verticalAlign="middle"
                                                    />
                                                </>
                                            )}
                                            )
                                        </HStack>
                                    );
                                })}
                            </Box>
                        );
                    })
                ) : (
                    <Center
                        opacity="50%"
                        w="full"
                    >
                        No compatible nodes found.
                    </Center>
                )}
            </Box>
        </MenuList>
    ));

    useEffect(() => {
        if (connectingFrom && connectingFrom.handleId) {
            const { nodeId, inOutId } = parseHandle(connectingFrom.handleId);
            const node: Node<NodeData> | undefined = getNode(nodeId);
            if (node && connectingFrom.handleType) {
                if (connectingFrom.handleType === 'source') {
                    const sourceType = functionDefinitions
                        .get(node.data.schemaId)
                        ?.outputDefaults.get(inOutId);
                    setConnectingFromType(sourceType ?? null);
                } else if (connectingFrom.handleType === 'target') {
                    const targetType = functionDefinitions
                        .get(node.data.schemaId)
                        ?.inputs.get(inOutId);
                    setConnectingFromType(targetType ?? null);
                } else {
                    log.error(`Unknown handle type: ${connectingFrom.handleType}`);
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
                // TODO: Maybe make this a setting, idk
                // (event.ctrlKey || event.metaKey) &&
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
