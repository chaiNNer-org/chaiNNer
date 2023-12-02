import {
    BackendJsonEdgeInput,
    BackendJsonInput,
    BackendJsonNode,
    EdgeData,
    InputId,
    NodeData,
    OutputId,
} from '../common-types';
import { SchemaMap } from '../SchemaMap';
import { ParsedSourceHandle, mapInputValues, parseSourceHandle, parseTargetHandle } from '../util';
import type { Edge, Node } from 'reactflow';

export const toBackendJson = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[],
    schemata: SchemaMap,
): BackendJsonNode[] => {
    const nodeSchemaMap = new Map(nodes.map((n) => [n.id, schemata.get(n.data.schemaId)]));
    const convertHandle = (handle: ParsedSourceHandle): BackendJsonEdgeInput => {
        const schema = nodeSchemaMap.get(handle.nodeId);
        if (!schema) {
            throw new Error(`Invalid handle: The node id ${handle.nodeId} is not valid`);
        }

        const index = schema.outputs.findIndex((inOut) => inOut.id === handle.outputId);
        if (index === -1) {
            throw new Error(
                `Invalid handle: There is no output with id ${handle.outputId} in ${schema.name}`,
            );
        }

        return { type: 'edge', id: handle.nodeId, index };
    };

    type Handles<I extends InputId | OutputId> = Record<
        string,
        Record<I, BackendJsonEdgeInput | undefined> | undefined
    >;
    const inputHandles: Handles<InputId> = {};
    edges.forEach((element) => {
        const { sourceHandle, targetHandle } = element;
        if (!sourceHandle || !targetHandle) return;

        const sourceH = parseSourceHandle(sourceHandle);
        const targetH = parseTargetHandle(targetHandle);

        (inputHandles[targetH.nodeId] ??= {})[targetH.inputId] = convertHandle(sourceH);
    });

    const result: BackendJsonNode[] = [];

    // Set up each node in the result
    nodes.forEach((element) => {
        const { id, data, type: nodeType } = element;
        const { schemaId, inputData } = data;
        const schema = schemata.get(schemaId);

        if (!nodeType) {
            throw new Error(
                `Expected all nodes to have a node type, but ${schema.name} (id: ${schemaId}) node did not.`,
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
                        value: inputData[inputId] ?? null,
                    },
            ),
            nodeType,
        });
    });

    return result;
};
