import {
    BackendJsonEdgeInput,
    BackendJsonInput,
    BackendJsonNode,
    EdgeData,
    InputId,
    InputValue,
    NodeData,
    OutputId,
} from '../common-types';
import { SchemaMap } from '../SchemaMap';
import {
    ParsedSourceHandle,
    ParsedTargetHandle,
    mapInputValues,
    parseSourceHandle,
    parseTargetHandle,
} from '../util';
import { builtInNodeSchemaIds, executionNumberNode } from './builtInNodes';
import type { Edge, Node } from 'reactflow';

interface ExtraBackendDataContext {
    executionNumber: number;
}

export const toBackendJson = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[],
    schemata: SchemaMap,
    context: ExtraBackendDataContext
): BackendJsonNode[] => {
    const nodeSchemaMap = new Map(nodes.map((n) => [n.id, schemata.get(n.data.schemaId)]));
    const convertSourceHandle = (handle: ParsedSourceHandle): BackendJsonEdgeInput => {
        const schema = nodeSchemaMap.get(handle.nodeId);
        if (!schema) {
            throw new Error(`Invalid handle: The node id ${handle.nodeId} is not valid`);
        }

        const index = schema.outputs.findIndex((inOut) => inOut.id === handle.outputId);
        if (index === -1) {
            throw new Error(
                `Invalid handle: There is no output with id ${handle.outputId} in ${schema.name}`
            );
        }

        return { type: 'edge', id: handle.nodeId, index };
    };

    type Handles<I extends InputId | OutputId> = Record<
        string,
        Record<I, BackendJsonEdgeInput | undefined> | undefined
    >;
    type HandlesArray<I extends InputId | OutputId> = Record<
        string,
        Record<I, ParsedTargetHandle[] | undefined> | undefined
    >;
    const inputHandles: Handles<InputId> = {};
    const outputHandles: HandlesArray<OutputId> = {};
    edges.forEach((element) => {
        const { sourceHandle, targetHandle } = element;
        if (!sourceHandle || !targetHandle) return;

        const sourceH = parseSourceHandle(sourceHandle);
        const targetH = parseTargetHandle(targetHandle);

        (inputHandles[targetH.nodeId] ??= {})[targetH.inputId] = convertSourceHandle(sourceH);
        ((outputHandles[sourceH.nodeId] ??= {})[sourceH.outputId] ??= []).push(targetH);
    });

    const builtInNodes = nodes.filter((n) => builtInNodeSchemaIds.includes(n.data.schemaId));
    const notBuiltInNodes = nodes.filter((n) => !builtInNodeSchemaIds.includes(n.data.schemaId));

    const extraInputData: Record<string, Record<InputId, InputValue> | undefined> = {};
    builtInNodes.forEach((node) => {
        const attachedNodes = outputHandles[node.id];

        if (!attachedNodes) {
            return;
        }

        const { schemaId } = node.data;
        switch (schemaId) {
            case executionNumberNode.schemaId:
                attachedNodes[0 as OutputId]?.forEach((a) => {
                    (extraInputData[a.nodeId] ??= {})[a.inputId] = context.executionNumber;
                    delete inputHandles[a.nodeId]?.[a.inputId];
                });
                break;
            default:
                break;
        }
    });

    const result: BackendJsonNode[] = [];

    // Set up each node in the result
    notBuiltInNodes.forEach((element) => {
        const { id, data, type: nodeType } = element;
        const { schemaId, inputData } = data;
        const schema = schemata.get(schemaId);

        if (!nodeType) {
            throw new Error(
                `Expected all nodes to have a node type, but ${schema.name} (id: ${schemaId}) node did not.`
            );
        }

        // Node
        result.push({
            id,
            schemaId,
            inputs: mapInputValues<BackendJsonInput>(
                schema,
                (inputId) =>
                    inputHandles[id]?.[inputId] ?? {
                        type: 'value',
                        value: extraInputData[id]?.[inputId] ?? inputData[inputId] ?? null,
                    }
            ),
            nodeType,
        });
    });

    return result;
};
