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
    useColorModeValue,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Node, OnConnectStartParams, useReactFlow } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { NodeData, NodeSchema } from '../../common/common-types';
import { isDisjointWith } from '../../common/types/intersection';
import { Type } from '../../common/types/types';
import {
    assertNever,
    createUniqueId,
    parseSourceHandle,
    parseTargetHandle,
} from '../../common/util';
import { IconFactory } from '../components/CustomIcons';
import { ContextMenuContext } from '../contexts/ContextMenuContext';
import { GlobalContext, GlobalVolatileContext, NodeProto } from '../contexts/GlobalNodeState';
import { getNodeAccentColor } from '../helpers/getNodeAccentColor';
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
    const { createNode, createConnection, typeState, useConnectingFromType, useConnectingFrom } =
        useContext(GlobalVolatileContext);
    const { closeContextMenu } = useContext(ContextMenuContext);
    const { schemata, functionDefinitions } = useContext(GlobalContext);

    const [connectingFrom, setConnectingFrom] = useState<OnConnectStartParams | null>(null);
    const [, setGlobalConnectingFromType] = useConnectingFromType;
    const [, setGlobalConnectingFrom] = useConnectingFrom;
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
                switch (connectingFrom.handleType) {
                    case 'source': {
                        const sourceFn = typeState.functions.get(connectingFrom.nodeId);

                        if (!sourceFn) {
                            return false;
                        }

                        const { inOutId } = parseSourceHandle(connectingFrom.handleId);
                        const sourceType = sourceFn.outputs.get(inOutId);

                        if (!sourceType) {
                            return false;
                        }

                        const targetTypes = functionDefinitions.get(node.schemaId);

                        if (!targetTypes) {
                            return false;
                        }

                        return [...targetTypes.inputDefaults].some(([inputId, type]) => {
                            return (
                                !isDisjointWith(type, sourceType) &&
                                schemata.get(node.schemaId).inputs.find((i) => i.id === inputId)
                                    ?.hasHandle
                            );
                        });
                    }
                    case 'target': {
                        const sourceNode = getNode(connectingFrom.nodeId) as Node<NodeData>;
                        const sourceFn = functionDefinitions.get(sourceNode.data.schemaId);

                        if (!sourceFn) {
                            return false;
                        }

                        const { inOutId } = parseTargetHandle(connectingFrom.handleId);
                        const sourceType = sourceFn.inputDefaults.get(inOutId);

                        if (!sourceType) {
                            return false;
                        }

                        const targetTypes = functionDefinitions.get(node.schemaId);

                        if (!targetTypes) {
                            return false;
                        }

                        return [...targetTypes.outputDefaults].some(([, type]) => {
                            return !isDisjointWith(type, sourceType);
                        });
                    }
                    default:
                        assertNever(connectingFrom.handleType);
                }
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
            if (
                isStoppedOnPane &&
                connectingFrom &&
                targetTypes &&
                connectingFromType &&
                connectingFrom.handleType
            ) {
                switch (connectingFrom.handleType) {
                    case 'source': {
                        const firstPossibleTarget = [...targetTypes.inputDefaults].find(
                            ([inputId, type]) => {
                                return (
                                    !isDisjointWith(type, connectingFromType) &&
                                    schemata
                                        .get(schema.schemaId)
                                        .inputs.find((i) => i.id === inputId)?.hasHandle
                                );
                            }
                        );
                        if (firstPossibleTarget) {
                            createConnection({
                                source: connectingFrom.nodeId,
                                sourceHandle: connectingFrom.handleId,
                                target: nodeId,
                                targetHandle: `${nodeId}-${firstPossibleTarget[0]}`,
                            });
                        }
                        break;
                    }
                    case 'target': {
                        const firstPossibleTarget = [...targetTypes.outputDefaults].find(
                            ([, type]) => {
                                return !isDisjointWith(type, connectingFromType);
                            }
                        );
                        if (firstPossibleTarget) {
                            createConnection({
                                source: nodeId,
                                sourceHandle: `${nodeId}-${firstPossibleTarget[0]}`,
                                target: connectingFrom.nodeId,
                                targetHandle: connectingFrom.handleId,
                            });
                        }
                        break;
                    }
                    default:
                        assertNever(connectingFrom.handleType);
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

    const menuBgColor = useColorModeValue('gray.200', 'gray.800');
    const bgColor = useColorModeValue('gray.300', 'gray.700');
    const inputColor = useColorModeValue('gray.500', 'gray.300');
    const hoverColor = useColorModeValue('black', 'white');

    const menu = useContextMenu(() => (
        <MenuList
            bgColor={menuBgColor}
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
                    color={inputColor}
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
                    _hover={{ color: hoverColor }}
                    style={{
                        color: inputColor,
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
                        const accentColor = getNodeAccentColor(category);
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
        if (connectingFrom && connectingFrom.handleId && connectingFrom.nodeId) {
            const node: Node<NodeData> | undefined = getNode(connectingFrom.nodeId);
            if (node?.data.parentNode) {
                setConnectingFrom(null);
                setConnectingFromType(null);
            }
            if (node && connectingFrom.handleType) {
                switch (connectingFrom.handleType) {
                    case 'source': {
                        const { inOutId } = parseSourceHandle(connectingFrom.handleId);
                        const sourceType = functionDefinitions
                            .get(node.data.schemaId)
                            ?.outputDefaults.get(inOutId);
                        setConnectingFromType(sourceType ?? null);
                        setGlobalConnectingFromType(sourceType ?? null);
                        break;
                    }
                    case 'target': {
                        const { inOutId } = parseTargetHandle(connectingFrom.handleId);
                        const targetType = functionDefinitions
                            .get(node.data.schemaId)
                            ?.inputDefaults.get(inOutId);
                        setConnectingFromType(targetType ?? null);
                        setGlobalConnectingFromType(targetType ?? null);
                        break;
                    }
                    default:
                        assertNever(connectingFrom.handleType);
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
            setGlobalConnectingFrom(handle);
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
            setGlobalConnectingFromType(null);
            setGlobalConnectingFrom(null);
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
