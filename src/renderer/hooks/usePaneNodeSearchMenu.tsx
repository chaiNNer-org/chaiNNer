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
import { memo, useCallback, useMemo, useState } from 'react';
import { Node, OnConnectStartParams, useReactFlow } from 'reactflow';
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
import { GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { interpolateColor } from '../helpers/colorTools';
import { getNodeAccentColor } from '../helpers/getNodeAccentColor';
import { getMatchingNodes, getNodesByCategory, sortSchemata } from '../helpers/nodeSearchFuncs';
import { TypeState } from '../helpers/TypeState';
import { useContextMenu } from './useContextMenu';
import { useNodeFavorites } from './useNodeFavorites';
import { useThemeColor } from './useThemeColor';

type ConnectionTarget =
    | { type: 'source'; input: InputId }
    | { type: 'target'; output: OutputId }
    | { type: 'none' };

interface MenuProps {
    onSelect: (schema: NodeSchema, target: ConnectionTarget) => void;
    targets: ReadonlyMap<NodeSchema, ConnectionTarget>;
    schemata: readonly NodeSchema[];
    favorites: ReadonlySet<SchemaId>;
    categories: Category[];
}

const Menu = memo(({ onSelect, targets, schemata, favorites, categories }: MenuProps) => {
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
                                        onSelect(favorite, targets.get(favorite)!);
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
                                                onSelect(schema, targets.get(schema)!);
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

const getConnectionTarget = (
    connectingFrom: OnConnectStartParams | null,
    schema: NodeSchema,
    typeState: TypeState,
    functionDefinitions: ReadonlyMap<SchemaId, FunctionDefinition>,
    getNode: (id: string) => Node<NodeData> | undefined
): ConnectionTarget | undefined => {
    if (!connectingFrom?.nodeId || !connectingFrom.handleId || !connectingFrom.handleType) {
        return { type: 'none' };
    }
    switch (connectingFrom.handleType) {
        case 'source': {
            const { inOutId } = parseSourceHandle(connectingFrom.handleId);
            const sourceType = typeState.functions.get(connectingFrom.nodeId)?.outputs.get(inOutId);
            if (!sourceType) {
                return undefined;
            }

            const targetFn = functionDefinitions.get(schema.schemaId);
            if (!targetFn) {
                return undefined;
            }

            const input = getFirstPossibleInput(targetFn, sourceType);
            if (input === undefined) {
                return undefined;
            }

            return { type: 'source', input };
        }
        case 'target': {
            const sourceNode = getNode(connectingFrom.nodeId);
            if (!sourceNode) {
                return undefined;
            }
            const sourceFn = functionDefinitions.get(sourceNode.data.schemaId);
            if (!sourceFn) {
                return undefined;
            }

            const { inOutId } = parseTargetHandle(connectingFrom.handleId);
            const sourceType = sourceFn.inputDefaults.get(inOutId);
            if (!sourceType) {
                return undefined;
            }

            const targetFn = functionDefinitions.get(schema.schemaId);
            if (!targetFn) {
                return undefined;
            }

            const output = getFirstPossibleOutput(targetFn, sourceType);
            if (output === undefined) {
                return undefined;
            }

            return { type: 'target', output };
        }
        default:
            return assertNever(connectingFrom.handleType);
    }
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
    const { closeContextMenu } = useContext(ContextMenuContext);
    const { schemata, functionDefinitions, categories } = useContext(BackendContext);

    const { favorites } = useNodeFavorites();

    const [connectingFrom, setConnectingFrom] = useState<OnConnectStartParams | null>(null);
    const [, setGlobalConnectingFrom] = useConnectingFrom;
    const [stoppedOnIterator, setStoppedOnIterator] = useState<string | null>(null);

    const { getNode, project } = useReactFlow();

    const [mousePosition, setMousePosition] = useState<Position>({ x: 0, y: 0 });

    const matchingTargets = useMemo(() => {
        return new Map<NodeSchema, ConnectionTarget>(
            schemata.schemata.flatMap((schema) => {
                if (schema.deprecated) return [];
                const target = getConnectionTarget(
                    connectingFrom,
                    schema,
                    typeState,
                    functionDefinitions,
                    getNode
                );
                if (!target) return [];

                return [[schema, target] as const];
            })
        );
    }, [connectingFrom, schemata, typeState, functionDefinitions, getNode]);
    const matchingSchemata = useMemo(() => [...matchingTargets.keys()], [matchingTargets]);

    const onSchemaSelect = useCallback(
        (schema: NodeSchema, target: ConnectionTarget) => {
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
            if (connectingFrom && targetFn && target.type !== 'none') {
                switch (target.type) {
                    case 'source': {
                        createConnection({
                            source: connectingFrom.nodeId,
                            sourceHandle: connectingFrom.handleId,
                            target: nodeId,
                            targetHandle: stringifyTargetHandle(nodeId, target.input),
                        });
                        break;
                    }
                    case 'target': {
                        createConnection({
                            source: nodeId,
                            sourceHandle: stringifySourceHandle(nodeId, target.output),
                            target: connectingFrom.nodeId,
                            targetHandle: connectingFrom.handleId,
                        });
                        break;
                    }
                    default:
                        assertNever(target);
                }
            }

            setConnectingFrom(null);
            setGlobalConnectingFrom(null);
            setStoppedOnIterator(null);
            closeContextMenu();
        },
        [connectingFrom, createConnection, createNode, mousePosition, stoppedOnIterator]
    );

    const menuProps: MenuProps = {
        onSelect: onSchemaSelect,
        targets: matchingTargets,
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
            const target = event.target as Element | SVGTextPathElement;

            setMousePosition({
                x: event.pageX,
                y: event.pageY,
            });

            const isStoppedOnPane = target.classList.contains('react-flow__pane');

            const firstClass = target.classList[0] || '';
            const stoppedIteratorId =
                typeof target.className === 'object' && firstClass.startsWith('iterator-editor=')
                    ? firstClass.slice('iterator-editor='.length)
                    : undefined;

            if (isStoppedOnPane || stoppedIteratorId) {
                const fromNode = getNode(connectingFrom?.nodeId ?? '');
                // Handle case of dragging from inside iterator to outside
                if (!(fromNode && fromNode.parentNode && isStoppedOnPane)) {
                    menu.manuallyOpenContextMenu(event.pageX, event.pageY);
                }
                if (stoppedIteratorId) {
                    setStoppedOnIterator(stoppedIteratorId);
                }
            }
            setGlobalConnectingFrom(null);
        },
        [setGlobalConnectingFrom, setMousePosition, menu, setStoppedOnIterator, connectingFrom]
    );

    const onPaneContextMenu = useCallback(
        (event: React.MouseEvent) => {
            setConnectingFrom(null);
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
