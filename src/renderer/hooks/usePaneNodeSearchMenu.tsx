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
} from '@chakra-ui/react';
import log from 'electron-log';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Node, OnConnectStartParams, useReactFlow } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import {
    Category,
    InputId,
    NodeData,
    NodeSchema,
    OutputId,
    SchemaId,
} from '../../common/common-types';
import { FunctionDefinition } from '../../common/types/function';
import { Type } from '../../common/types/types';
import {
    assertNever,
    createUniqueId,
    parseSourceHandle,
    parseTargetHandle,
    stringifySourceHandle,
    stringifyTargetHandle,
} from '../../common/util';
import { IconFactory } from '../components/CustomIcons';
import { BackendContext } from '../contexts/BackendContext';
import { ContextMenuContext } from '../contexts/ContextMenuContext';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { interpolateColor } from '../helpers/colorTools';
import { getNodeAccentColor } from '../helpers/getNodeAccentColor';
import { getMatchingNodes, getNodesByCategory, sortSchemata } from '../helpers/nodeSearchFuncs';
import { TypeState } from '../helpers/TypeState';
import { useContextMenu } from './useContextMenu';
import { useNodeFavorites } from './useNodeFavorites';
import { useThemeColor } from './useThemeColor';

interface MenuProps {
    onSelect: (schema: NodeSchema) => void;
    schemata: readonly NodeSchema[];
    favorites: ReadonlySet<SchemaId>;
    categories: Category[];
}

const Menu = memo(({ onSelect, schemata, favorites, categories }: MenuProps) => {
    const [searchQuery, setSearchQuery] = useState('');

    const byCategories = useMemo(
        () => getNodesByCategory(getMatchingNodes(searchQuery, sortSchemata(schemata))),
        [searchQuery, schemata]
    );

    const favoriteNodes = useMemo(() => {
        return [...byCategories.values()].flat().filter((n) => favorites.has(n.schemaId));
    }, [byCategories, favorites]);

    const bgColor = useThemeColor('--bg-700');
    const menuBgColor = useThemeColor('--bg-800');
    const inputColor = 'var(--fg-300)';

    return (
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
                    _hover={{ color: 'var(--fg-000)' }}
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
                {favoriteNodes.length > 0 && (
                    <Box>
                        <HStack
                            borderRadius="md"
                            mx={1}
                            py={0.5}
                        >
                            <StarIcon
                                boxSize={3}
                                color="yellow.500"
                            />
                            <Text fontSize="xs">Favorites</Text>
                        </HStack>
                        {favoriteNodes.map((favorite) => {
                            const accentColor = getNodeAccentColor(favorite.category);
                            const gradL = interpolateColor(accentColor, menuBgColor, 0.95);
                            const gradR = menuBgColor;
                            const hoverGradL = interpolateColor(accentColor, bgColor, 0.95);
                            const hoverGradR = bgColor;
                            return (
                                <HStack
                                    _hover={{
                                        bgGradient: `linear(to-r, ${hoverGradL}, ${hoverGradR})`,
                                    }}
                                    bgGradient={`linear(to-r, ${gradL}, ${gradR})`}
                                    borderRadius="md"
                                    key={favorite.schemaId}
                                    mx={1}
                                    my={0.5}
                                    px={2}
                                    py={0.5}
                                    onClick={() => {
                                        setSearchQuery('');
                                        onSelect(favorite);
                                    }}
                                >
                                    <IconFactory
                                        accentColor="gray.500"
                                        icon={favorite.icon}
                                    />
                                    <Text
                                        h="full"
                                        verticalAlign="middle"
                                    >
                                        {favorite.name}
                                    </Text>
                                </HStack>
                            );
                        })}
                    </Box>
                )}

                {byCategories.size > 0 ? (
                    [...byCategories].map(([category, categorySchemata]) => {
                        const accentColor = getNodeAccentColor(category);
                        const gradL = interpolateColor(accentColor, menuBgColor, 0.95);
                        const gradR = menuBgColor;
                        const hoverGradL = interpolateColor(accentColor, bgColor, 0.95);
                        const hoverGradR = bgColor;
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
                                        icon={categories.find((c) => c.name === category)?.icon}
                                    />
                                    <Text fontSize="xs">{category}</Text>
                                </HStack>
                                {[...categorySchemata].map((schema) => {
                                    const isFavorite = favorites.has(schema.schemaId);
                                    return (
                                        <HStack
                                            _hover={{
                                                bgGradient: `linear(to-r, ${hoverGradL}, ${hoverGradR})`,
                                            }}
                                            bgGradient={`linear(to-r, ${gradL}, ${gradR})`}
                                            borderRadius="md"
                                            key={schema.schemaId}
                                            mx={1}
                                            my={0.5}
                                            px={2}
                                            py={0.5}
                                            onClick={() => {
                                                setSearchQuery('');
                                                onSelect(schema);
                                            }}
                                        >
                                            <IconFactory
                                                accentColor="gray.500"
                                                icon={schema.icon}
                                            />
                                            <Text
                                                h="full"
                                                verticalAlign="middle"
                                            >
                                                {schema.name}
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
    );
});

const getFirstPossibleInput = (fn: FunctionDefinition, type: Type): InputId | undefined =>
    fn.schema.inputs.find((i) => i.hasHandle && fn.canAssignInput(i.id, type))?.id;
const getFirstPossibleOutput = (fn: FunctionDefinition, type: Type): OutputId | undefined =>
    fn.schema.outputs.find((o) => o.hasHandle && fn.canAssignOutput(o.id, type))?.id;

const canConnectWith = (
    connectingFrom: OnConnectStartParams,
    schema: NodeSchema,
    typeState: TypeState,
    functionDefinitions: ReadonlyMap<SchemaId, FunctionDefinition>,
    getNode: (id: string) => Node<NodeData> | undefined
): boolean => {
    if (!connectingFrom.nodeId || !connectingFrom.handleId || !connectingFrom.handleType) {
        return true;
    }
    switch (connectingFrom.handleType) {
        case 'source': {
            const { inOutId } = parseSourceHandle(connectingFrom.handleId);
            const sourceType = typeState.functions.get(connectingFrom.nodeId)?.outputs.get(inOutId);
            if (!sourceType) {
                return false;
            }

            const targetFn = functionDefinitions.get(schema.schemaId);
            if (!targetFn) {
                return false;
            }

            return getFirstPossibleInput(targetFn, sourceType) !== undefined;
        }
        case 'target': {
            const sourceNode = getNode(connectingFrom.nodeId);
            if (!sourceNode) {
                return false;
            }
            const sourceFn = functionDefinitions.get(sourceNode.data.schemaId);
            if (!sourceFn) {
                return false;
            }

            const { inOutId } = parseTargetHandle(connectingFrom.handleId);
            const sourceType = sourceFn.inputDefaults.get(inOutId);
            if (!sourceType) {
                return false;
            }

            const targetFn = functionDefinitions.get(schema.schemaId);
            if (!targetFn) {
                return false;
            }

            return getFirstPossibleOutput(targetFn, sourceType) !== undefined;
        }
        default:
            assertNever(connectingFrom.handleType);
    }
    return true;
};

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
    const { createNode, createConnection, typeState, useConnectingFrom } =
        useContext(GlobalVolatileContext);
    const { updateIteratorBounds } = useContext(GlobalContext);
    const { closeContextMenu } = useContext(ContextMenuContext);
    const { schemata, functionDefinitions, categories } = useContext(BackendContext);

    const { favorites } = useNodeFavorites();

    const [connectingFrom, setConnectingFrom] = useState<OnConnectStartParams | null>(null);
    const [, setGlobalConnectingFrom] = useConnectingFrom;
    const [connectingFromType, setConnectingFromType] = useState<Type | null>(null);
    const [stoppedOnIterator, setStoppedOnIterator] = useState<string | null>(null);

    const { getNode, project } = useReactFlow();

    const [mousePosition, setMousePosition] = useState<Position>({ x: 0, y: 0 });

    const matchingSchemata = useMemo(
        () =>
            schemata.schemata.filter((schema) => {
                if (schema.deprecated) return false;
                return (
                    !connectingFrom ||
                    !connectingFromType ||
                    canConnectWith(connectingFrom, schema, typeState, functionDefinitions, getNode)
                );
            }),
        [connectingFrom, connectingFromType, schemata, typeState, functionDefinitions, getNode]
    );

    const onSchemaSelect = useCallback(
        (schema: NodeSchema) => {
            const reactFlowBounds = wrapperRef.current!.getBoundingClientRect();
            const { x, y } = mousePosition;
            const projPosition = project({
                x: x - reactFlowBounds.left,
                y: y - reactFlowBounds.top,
            });
            const nodeId = createUniqueId();
            createNode(
                {
                    id: nodeId,
                    position: projPosition,
                    data: {
                        schemaId: schema.schemaId,
                    },
                    nodeType: schema.nodeType,
                },
                stoppedOnIterator || undefined
            );
            const targetFn = functionDefinitions.get(schema.schemaId);
            if (connectingFrom && targetFn && connectingFromType && connectingFrom.handleType) {
                switch (connectingFrom.handleType) {
                    case 'source': {
                        const first = getFirstPossibleInput(targetFn, connectingFromType);
                        if (first !== undefined) {
                            createConnection({
                                source: connectingFrom.nodeId,
                                sourceHandle: connectingFrom.handleId,
                                target: nodeId,
                                targetHandle: stringifyTargetHandle(nodeId, first),
                            });
                        }
                        break;
                    }
                    case 'target': {
                        const first = getFirstPossibleOutput(targetFn, connectingFromType);
                        if (first !== undefined) {
                            createConnection({
                                source: nodeId,
                                sourceHandle: stringifySourceHandle(nodeId, first),
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
            setGlobalConnectingFrom(null);
            setConnectingFromType(null);
            setStoppedOnIterator(null);
            closeContextMenu();
        },
        [
            connectingFrom,
            createConnection,
            createNode,
            connectingFromType,
            mousePosition,
            stoppedOnIterator,
        ]
    );

    const menuProps: MenuProps = {
        onSelect: onSchemaSelect,
        schemata: matchingSchemata,
        favorites,
        categories,
    };

    const menu = useContextMenu(
        () => (
            <Menu
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...menuProps}
            />
        ),
        Object.values(menuProps)
    );

    useEffect(() => {
        if (connectingFrom && connectingFrom.handleId && connectingFrom.nodeId) {
            const node: Node<NodeData> | undefined = getNode(connectingFrom.nodeId);
            if (node && connectingFrom.handleType) {
                switch (connectingFrom.handleType) {
                    case 'source': {
                        const { inOutId } = parseSourceHandle(connectingFrom.handleId);
                        const sourceType = functionDefinitions
                            .get(node.data.schemaId)
                            ?.outputDefaults.get(inOutId);
                        setConnectingFromType(sourceType ?? null);
                        break;
                    }
                    case 'target': {
                        const { inOutId } = parseTargetHandle(connectingFrom.handleId);
                        const targetType = functionDefinitions
                            .get(node.data.schemaId)
                            ?.inputDefaults.get(inOutId);
                        setConnectingFromType(targetType ?? null);
                        break;
                    }
                    default:
                        assertNever(connectingFrom.handleType);
                }
            }
        }
    }, [connectingFrom, setConnectingFrom, setConnectingFromType]);

    const onConnectStart = useCallback(
        (event: React.MouseEvent, handle: OnConnectStartParams) => {
            setMousePosition({
                x: event.pageX,
                y: event.pageY,
            });
            setConnectingFrom(handle);
            setGlobalConnectingFrom(handle);
        },
        [setConnectingFrom, setGlobalConnectingFrom, setMousePosition]
    );

    const onConnectStop = useCallback(
        (event: MouseEvent) => {
            setMousePosition({
                x: event.pageX,
                y: event.pageY,
            });
            const isStoppedOnPane = String((event.target as Element).className).includes('pane');
            const isStoppedOnIterator =
                typeof (event.target as Element).className === 'object' &&
                (event.target as Element).classList[0].includes('iterator-editor');
            if (isStoppedOnPane || isStoppedOnIterator) {
                const fromNode = getNode(connectingFrom?.nodeId ?? '');
                // Handle case of dragging from inside iterator to outside
                if (!(fromNode && fromNode.parentNode && isStoppedOnPane)) {
                    menu.manuallyOpenContextMenu(event.pageX, event.pageY);
                }
                if (isStoppedOnIterator) {
                    try {
                        const iteratorId = String((event.target as Element).classList[0])
                            .split('=')
                            .slice(-1)[0];
                        setStoppedOnIterator(iteratorId);
                    } catch (e) {
                        log.error('Unable to parse iterator id from class name', e);
                    }
                }
            }
            setGlobalConnectingFrom(null);
        },
        [setGlobalConnectingFrom, setMousePosition, menu, setStoppedOnIterator, connectingFrom]
    );

    const onPaneContextMenu = useCallback(
        (event: React.MouseEvent) => {
            setConnectingFrom(null);
            setConnectingFromType(null);
            setMousePosition({
                x: event.pageX,
                y: event.pageY,
            });
            menu.onContextMenu(event);
        },
        [setConnectingFrom, menu, setMousePosition]
    );

    return { onConnectStart, onConnectStop, onPaneContextMenu };
};
