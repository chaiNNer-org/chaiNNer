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
import { OnConnectStartParams, useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { CategoryMap } from '../../common/CategoryMap';
import {
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

interface SchemaItemProps {
    schema: NodeSchema;
    isFavorite?: boolean;
    accentColor: string;
    onClick: (schema: NodeSchema) => void;
}
const SchemaItem = memo(({ schema, onClick, isFavorite, accentColor }: SchemaItemProps) => {
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
            bgGradient={`linear(to-r, ${gradL}, ${gradR})`}
            borderRadius="md"
            key={schema.schemaId}
            mx={1}
            my={0.5}
            px={2}
            py={0.5}
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
});

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

    const byCategories: ReadonlyMap<CategoryId, readonly NodeSchema[]> = useMemo(
        () => groupBy(getMatchingNodes(searchQuery, schemata, categories), 'category'),
        [searchQuery, schemata, categories]
    );

    const favoriteNodes: readonly NodeSchema[] = useMemo(() => {
        return [...byCategories.values()].flat().filter((n) => favorites.has(n.schemaId));
    }, [byCategories, favorites]);

    const menuBgColor = useThemeColor('--bg-800');
    const inputColor = 'var(--fg-300)';

    const onClickHandler = useCallback(
        (schema: NodeSchema) => {
            setSearchQuery('');
            onSelect(schema);
        },
        [setSearchQuery, onSelect]
    );
    const onEnterHandler = useCallback(() => {
        const nodes = [...byCategories.values()].flat();
        if (nodes.length === 1) {
            onClickHandler(nodes[0]);
        }
    }, [byCategories, onClickHandler]);

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
                    onChange={(e) => setSearchQuery(e.target.value)}
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
                        {favoriteNodes.map((favorite) => (
                            <SchemaItem
                                accentColor={getCategoryAccentColor(categories, favorite.category)}
                                key={favorite.schemaId}
                                schema={favorite}
                                onClick={onClickHandler}
                            />
                        ))}
                    </Box>
                )}

                {byCategories.size > 0 ? (
                    [...byCategories].map(([categoryId, categorySchemata]) => {
                        const accentColor = getCategoryAccentColor(categories, categoryId);
                        const category = categories.get(categoryId);
                        return (
                            <Box key={categoryId}>
                                <HStack
                                    borderRadius="md"
                                    mx={1}
                                    py={0.5}
                                >
                                    <IconFactory
                                        accentColor={accentColor}
                                        boxSize={3}
                                        icon={category?.icon}
                                    />
                                    <Text fontSize="xs">{category?.name ?? categoryId}</Text>
                                </HStack>
                                {categorySchemata.map((schema) => (
                                    <SchemaItem
                                        accentColor={accentColor}
                                        isFavorite={favorites.has(schema.schemaId)}
                                        key={schema.schemaId}
                                        schema={schema}
                                        onClick={onClickHandler}
                                    />
                                ))}
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
