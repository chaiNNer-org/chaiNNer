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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OnConnectStartParams, useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { CategoryMap } from '../../common/CategoryMap';
import {
    Category,
    CategoryId,
    InputId,
    NodeData,
    NodeSchema,
    OutputId,
    SchemaId,
} from '../../common/common-types';
import { getFirstPossibleInput, getFirstPossibleOutput } from '../../common/nodes/connectedInputs';
import { ChainLineage } from '../../common/nodes/lineage';
import { TypeState } from '../../common/nodes/TypeState';
import { FunctionDefinition } from '../../common/types/function';
import {
    assertNever,
    createUniqueId,
    groupBy,
    isNotNullish,
    parseSourceHandle,
    parseTargetHandle,
    stopPropagation,
    stringifySourceHandle,
    stringifyTargetHandle,
} from '../../common/util';
import { IconFactory } from '../components/CustomIcons';
import { BackendContext } from '../contexts/BackendContext';
import { ContextMenuContext } from '../contexts/ContextMenuContext';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { getCategoryAccentColor } from '../helpers/accentColors';
import { interpolateColor } from '../helpers/colorTools';

import { getMatchingNodes } from '../helpers/nodeSearchFuncs';
import { useContextMenu } from './useContextMenu';
import { useNodeFavorites } from './useNodeFavorites';
import { useThemeColor } from './useThemeColor';

const clampWithWrap = (min: number, max: number, value: number): number => {
    if (value < min) {
        return max;
    }
    if (value > max) {
        return min;
    }
    return value;
};

interface SchemaItemProps {
    schema: NodeSchema;
    isFavorite: boolean;
    accentColor: string;
    onClick: (schema: NodeSchema) => void;
    isSelected: boolean;
    scrollRef?: React.RefObject<HTMLDivElement>;
}
const SchemaItem = memo(
    ({ schema, onClick, isFavorite, accentColor, isSelected, scrollRef }: SchemaItemProps) => {
        const bgColor = useThemeColor('--bg-700');
        const menuBgColor = useThemeColor('--bg-800');

        const gradL = interpolateColor(accentColor, menuBgColor, 0.95);
        const gradR = menuBgColor;
        const hoverGradL = interpolateColor(accentColor, bgColor, 0.95);
        const hoverGradR = bgColor;

        return (
            <HStack
                _hover={{
                    bgGradient: `linear(to-r, ${hoverGradL}, ${hoverGradR})`,
                }}
                bgGradient={
                    isSelected
                        ? `linear(to-r, ${hoverGradL}, ${hoverGradR})`
                        : `linear(to-r, ${gradL}, ${gradR})`
                }
                borderRadius="md"
                key={schema.schemaId}
                mx={1}
                my={0.5}
                outline={isSelected ? '1px solid' : undefined}
                px={2}
                py={0.5}
                ref={scrollRef}
                onClick={() => onClick(schema)}
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
            </HStack>
        );
    }
);

type SchemaGroup = FavoritesSchemaGroup | CategorySchemaGroup;
interface SchemaGroupBase {
    readonly name: string;
    readonly schemata: readonly NodeSchema[];
}
interface FavoritesSchemaGroup extends SchemaGroupBase {
    type: 'favorites';
    categoryId?: never;
}
interface CategorySchemaGroup extends SchemaGroupBase {
    type: 'category';
    categoryId: CategoryId;
    category: Category | undefined;
}

const groupSchemata = (
    schemata: readonly NodeSchema[],
    categories: CategoryMap,
    favorites: ReadonlySet<SchemaId>
): readonly SchemaGroup[] => {
    const cats = [...groupBy(schemata, 'category')].map(
        ([categoryId, categorySchemata]): CategorySchemaGroup => {
            const category = categories.get(categoryId);
            return {
                type: 'category',
                name: category?.name ?? categoryId,
                categoryId,
                category,
                schemata: categorySchemata,
            };
        }
    );

    const favs: FavoritesSchemaGroup = {
        type: 'favorites',
        name: 'Favorites',
        schemata: cats.flatMap((c) => c.schemata).filter((n) => favorites.has(n.schemaId)),
    };

    if (favs.schemata.length === 0) {
        return cats;
    }

    return [favs, ...cats];
};

interface MenuProps {
    onSelect: (schema: NodeSchema) => void;
    schemata: readonly NodeSchema[];
    favorites: ReadonlySet<SchemaId>;
    categories: CategoryMap;
    suggestions?: readonly SchemaId[];
}

const Menu = memo(({ onSelect, schemata, favorites, categories, suggestions }: MenuProps) => {
    console.log('🚀 ~ Menu ~ suggestions:', suggestions);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const changeSearchQuery = useCallback((query: string) => {
        setSearchQuery(query);
        setSelectedIndex(0);
    }, []);

    const groups = useMemo(() => {
        return groupSchemata(
            getMatchingNodes(searchQuery, schemata, categories),
            categories,
            favorites
        );
    }, [schemata, categories, favorites, searchQuery]);
    const flatGroups = useMemo(() => groups.flatMap((group) => group.schemata), [groups]);

    const onClickHandler = useCallback(
        (schema: NodeSchema) => {
            changeSearchQuery('');
            onSelect(schema);
        },
        [changeSearchQuery, onSelect]
    );
    const onEnterHandler = useCallback(() => {
        if (selectedIndex >= 0 && selectedIndex < flatGroups.length) {
            onClickHandler(flatGroups[selectedIndex]);
        }
    }, [flatGroups, onClickHandler, selectedIndex]);

    const keydownHandler = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                setSelectedIndex((i) => clampWithWrap(0, flatGroups.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
                setSelectedIndex((i) => clampWithWrap(0, flatGroups.length - 1, i - 1));
            }
        },
        [flatGroups]
    );
    useEffect(() => {
        window.addEventListener('keydown', keydownHandler);
        return () => window.removeEventListener('keydown', keydownHandler);
    }, [keydownHandler]);

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        scrollRef.current?.scrollIntoView({
            block: 'center',
            inline: 'nearest',
        });
    }, [selectedIndex]);

    const menuBgColor = useThemeColor('--bg-800');
    const inputColor = 'var(--fg-300)';

    return (
        <MenuList
            bgColor={menuBgColor}
            borderWidth={0}
            className="nodrag"
            overflow="hidden"
            onContextMenu={stopPropagation}
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
                    onChange={(e) => changeSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onEnterHandler();
                        }
                    }}
                />
                <InputRightElement
                    _hover={{ color: 'var(--fg-000)' }}
                    style={{
                        color: inputColor,
                        cursor: 'pointer',
                        display: searchQuery ? undefined : 'none',
                        fontSize: '66%',
                    }}
                    onClick={() => changeSearchQuery('')}
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
                {groups.map((group, groupIndex) => {
                    const indexOffset = groups
                        .slice(0, groupIndex)
                        .reduce((acc, g) => acc + g.schemata.length, 0);

                    return (
                        <Box key={group.categoryId ?? 'favs'}>
                            <HStack
                                borderRadius="md"
                                mx={1}
                                py={0.5}
                            >
                                {group.type === 'favorites' ? (
                                    <StarIcon
                                        boxSize={3}
                                        color="yellow.500"
                                    />
                                ) : (
                                    <IconFactory
                                        accentColor={getCategoryAccentColor(
                                            categories,
                                            group.categoryId
                                        )}
                                        boxSize={3}
                                        icon={group.category?.icon}
                                    />
                                )}
                                <Text fontSize="xs">{group.name}</Text>
                            </HStack>

                            {group.schemata.map((schema, schemaIndex) => {
                                const index = indexOffset + schemaIndex;
                                const isSelected = selectedIndex === index;

                                return (
                                    <SchemaItem
                                        accentColor={getCategoryAccentColor(
                                            categories,
                                            schema.category
                                        )}
                                        isFavorite={favorites.has(schema.schemaId)}
                                        isSelected={isSelected}
                                        key={schema.schemaId}
                                        schema={schema}
                                        scrollRef={isSelected ? scrollRef : undefined}
                                        onClick={onClickHandler}
                                    />
                                );
                            })}
                        </Box>
                    );
                })}

                {groups.length === 0 && (
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

type ConnectionStart = ConnectionStartSource | ConnectionStartTarget;
type ConnectionStartSource = { type: 'source'; nodeId: string; outputId: OutputId };
type ConnectionStartTarget = { type: 'target'; nodeId: string; inputId: InputId };
type ConnectionEnd =
    | { type: 'source'; start: ConnectionStartSource; input: InputId }
    | { type: 'target'; start: ConnectionStartTarget; output: OutputId };

const parseConnectStartParams = (params: OnConnectStartParams | null): ConnectionStart | null => {
    if (!params?.handleType || !params.handleId) {
        return null;
    }

    switch (params.handleType) {
        case 'source': {
            const { nodeId, outputId } = parseSourceHandle(params.handleId);
            return {
                type: 'source',
                nodeId,
                outputId,
            };
        }
        case 'target': {
            const { nodeId, inputId } = parseTargetHandle(params.handleId);
            return {
                type: 'target',
                nodeId,
                inputId,
            };
        }
        default:
            return assertNever(params.handleType);
    }
};

const getConnectionEnd = (
    start: ConnectionStart,
    schema: NodeSchema,
    typeState: TypeState,
    chainLineage: ChainLineage,
    functionDefinitions: ReadonlyMap<SchemaId, FunctionDefinition>
): ConnectionEnd | undefined => {
    switch (start.type) {
        case 'source': {
            const { nodeId, outputId } = start;

            const sourceType = typeState.functions.get(nodeId)?.outputs.get(outputId);
            const targetFn = functionDefinitions.get(schema.schemaId);
            if (!sourceType || !targetFn) {
                return undefined;
            }

            const input = getFirstPossibleInput(
                targetFn,
                sourceType,
                chainLineage.getOutputLineage(start) !== null
            );
            if (input === undefined) {
                return undefined;
            }

            return { type: 'source', start, input };
        }
        case 'target': {
            const { nodeId, inputId } = start;

            const sourceFn = typeState.functions.get(nodeId)?.definition;
            const targetFn = functionDefinitions.get(schema.schemaId);
            if (!sourceFn || !targetFn) {
                return undefined;
            }

            const output = getFirstPossibleOutput(targetFn, sourceFn, inputId);
            if (output === undefined) {
                return undefined;
            }

            return { type: 'target', start, output };
        }
        default:
            return assertNever(start);
    }
};

interface UsePaneNodeSearchMenuValue {
    readonly onConnectStart: (
        event: React.MouseEvent | React.TouchEvent,
        handle: OnConnectStartParams
    ) => void;
    readonly onConnectStop: (event: MouseEvent | TouchEvent) => void;
    readonly onPaneContextMenu: (event: React.MouseEvent) => void;
}

interface Position {
    readonly x: number;
    readonly y: number;
}

export const usePaneNodeSearchMenu = (): UsePaneNodeSearchMenuValue => {
    const typeState = useContextSelector(GlobalVolatileContext, (c) => c.typeState);
    const chainLineage = useContextSelector(GlobalVolatileContext, (c) => c.chainLineage);
    const useConnectingFrom = useContextSelector(GlobalVolatileContext, (c) => c.useConnectingFrom);
    const { createNode, createConnection } = useContext(GlobalContext);
    const { closeContextMenu } = useContext(ContextMenuContext);
    const { schemata, functionDefinitions, categories } = useContext(BackendContext);
    const { getNode } = useReactFlow<NodeData>();

    const { favorites } = useNodeFavorites();

    const [connectingFrom, setConnectingFrom] = useState<OnConnectStartParams | null>(null);
    const [, setGlobalConnectingFrom] = useConnectingFrom;

    const { screenToFlowPosition } = useReactFlow();

    const [mousePosition, setMousePosition] = useState<Position>({ x: 0, y: 0 });

    const matchingEnds = useMemo(() => {
        const connection = parseConnectStartParams(connectingFrom);

        return new Map<NodeSchema, ConnectionEnd | null>(
            schemata.schemata
                .map((schema) => {
                    if (schema.deprecated) return undefined;
                    if (!connection) return [schema, null] as const;

                    const end = getConnectionEnd(
                        connection,
                        schema,
                        typeState,
                        chainLineage,
                        functionDefinitions
                    );
                    if (!end) return undefined;

                    return [schema, end] as const;
                })
                .filter(isNotNullish)
        );
    }, [schemata.schemata, connectingFrom, typeState, chainLineage, functionDefinitions]);

    const onSchemaSelect = useCallback(
        (schema: NodeSchema) => {
            const { x, y } = mousePosition;
            const projPosition = screenToFlowPosition({ x, y });
            const nodeId = createUniqueId();
            createNode({
                id: nodeId,
                position: projPosition,
                data: {
                    schemaId: schema.schemaId,
                },
            });

            const end = matchingEnds.get(schema);
            if (end) {
                switch (end.type) {
                    case 'source': {
                        const { start } = end;
                        createConnection({
                            source: start.nodeId,
                            sourceHandle: stringifySourceHandle(start),
                            target: nodeId,
                            targetHandle: stringifyTargetHandle({ nodeId, inputId: end.input }),
                        });
                        break;
                    }
                    case 'target': {
                        const { start } = end;
                        createConnection({
                            source: nodeId,
                            sourceHandle: stringifySourceHandle({ nodeId, outputId: end.output }),
                            target: start.nodeId,
                            targetHandle: stringifyTargetHandle(start),
                        });
                        break;
                    }
                    default:
                        assertNever(end);
                }
            }

            setConnectingFrom(null);
            setGlobalConnectingFrom(null);
            closeContextMenu();
        },
        [
            closeContextMenu,
            createConnection,
            createNode,
            mousePosition,
            screenToFlowPosition,
            setGlobalConnectingFrom,
            matchingEnds,
        ]
    );

    const suggestions = useMemo(() => {
        const connection = parseConnectStartParams(connectingFrom);

        if (!connection) return;

        const node = getNode(connection.nodeId);

        if (!node) return;

        const connectingFromSchema = schemata.get(node.data.schemaId);

        switch (connection.type) {
            case 'source': {
                const outputSchema = connectingFromSchema.outputs[connection.outputId];
                const { recommendedConnections: recs } = outputSchema;
                return recs?.filter((r) => matchingEnds.has(schemata.get(r)));
            }
            case 'target': {
                const outputSchema = connectingFromSchema.inputs[connection.inputId];
                const { recommendedConnections: recs } = outputSchema;
                return recs?.filter((r) => matchingEnds.has(schemata.get(r)));
            }
            default:
                assertNever(connection);
        }
    }, [connectingFrom, getNode, matchingEnds, schemata]);

    const menuSchemata = useMemo(() => [...matchingEnds.keys()], [matchingEnds]);
    const menu = useContextMenu(() => (
        <Menu
            categories={categories}
            favorites={favorites}
            schemata={menuSchemata}
            suggestions={suggestions}
            onSelect={onSchemaSelect}
        />
    ));

    const onConnectStart = useCallback(
        (event: React.MouseEvent | React.TouchEvent, handle: OnConnectStartParams) => {
            // eslint-disable-next-line no-param-reassign
            event = event as React.MouseEvent;
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
        (event: MouseEvent | TouchEvent) => {
            // eslint-disable-next-line no-param-reassign
            event = event as MouseEvent;
            const target = event.target as Element | SVGTextPathElement;

            setMousePosition({
                x: event.pageX,
                y: event.pageY,
            });

            const isStoppedOnPane = target.classList.contains('react-flow__pane');

            if (isStoppedOnPane) {
                menu.manuallyOpenContextMenu(event.pageX, event.pageY);
            }
            setGlobalConnectingFrom(null);
        },
        [menu, setGlobalConnectingFrom, setMousePosition]
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
