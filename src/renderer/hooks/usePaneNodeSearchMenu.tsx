import { useCallback, useMemo, useState } from 'react';
import { OnConnectStartParams, useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { InputId, NodeSchema, OutputId, SchemaId } from '../../common/common-types';
import { getFirstPossibleInput, getFirstPossibleOutput } from '../../common/nodes/connectedInputs';
import { ChainLineage } from '../../common/nodes/lineage';
import { TypeState } from '../../common/nodes/TypeState';
import { FunctionDefinition } from '../../common/types/function';
import {
    EMPTY_SET,
    assertNever,
    createUniqueId,
    isNotNullish,
    parseSourceHandle,
    parseTargetHandle,
    stringifySourceHandle,
    stringifyTargetHandle,
} from '../../common/util';
import { Menu } from '../components/PaneNodeSearchMenu';
import { BackendContext } from '../contexts/BackendContext';
import { ContextMenuContext } from '../contexts/ContextMenuContext';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { useContextMenu } from './useContextMenu';
import { useNodeFavorites } from './useNodeFavorites';

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
    const { schemata, functionDefinitions, categories, featureStates } = useContext(BackendContext);

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

    const suggestions: ReadonlySet<SchemaId> = useMemo(() => {
        const connection = parseConnectStartParams(connectingFrom);
        if (!connection) return EMPTY_SET;

        return new Set(
            [...matchingEnds.entries()]
                .filter(([schema, end]) => {
                    if (!end) return false;
                    return end.type === 'target'
                        ? schema.outputs.some((o) => o.suggest && o.id === end.output)
                        : schema.inputs.some((i) => i.suggest && i.id === end.input);
                })
                .map(([schema]) => schema.schemaId)
        );
    }, [connectingFrom, matchingEnds]);

    const menuSchemata = useMemo(() => [...matchingEnds.keys()], [matchingEnds]);
    const menu = useContextMenu(() => (
        <Menu
            categories={categories}
            favorites={favorites}
            featureStates={featureStates}
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
