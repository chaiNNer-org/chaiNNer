import { intersect } from '@chainner/navi';
import { EdgeData, InputId, NodeData } from '../common-types';
import { SchemaMap } from '../SchemaMap';
import { nullType } from '../types/util';
import { parseTargetHandle } from '../util';
import { TypeState } from './TypeState';
import type { Edge, Node } from 'reactflow';

export enum DisabledStatus {
    Enabled,
    DirectlyDisabled,
    ParentDisabled,
    InputDisabled,
}

export const getDisabledStatus = (
    data: NodeData,
    effectivelyDisabledNodes: ReadonlySet<string>
): DisabledStatus => {
    if (data.isDisabled) {
        return DisabledStatus.DirectlyDisabled;
    }
    if (effectivelyDisabledNodes.has(data.id)) {
        return DisabledStatus.InputDisabled;
    }
    return DisabledStatus.Enabled;
};

export const getEffectivelyDisabledNodes = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[],
    schemata: SchemaMap,
    typeState?: TypeState
): Node<NodeData>[] => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const incomingMap = new Map<
        Node<NodeData>,
        Array<{ source: Node<NodeData>; inputId: InputId }>
    >();
    for (const e of edges) {
        const source = byId.get(e.source);
        const target = byId.get(e.target);
        if (source && target && e.targetHandle) {
            const { inputId } = parseTargetHandle(e.targetHandle);
            let incoming = incomingMap.get(target);
            if (incoming === undefined) {
                incoming = [];
                incomingMap.set(target, incoming);
            }
            incoming.push({ source, inputId });
        }
    }

    const cache = new Map<Node<NodeData>, boolean>();

    // Helper to check if an optional input is required for the current node state
    // An optional input is considered required if its type does not include null
    const isOptionalInputRequired = (node: Node<NodeData>, inputId: InputId): boolean => {
        if (!typeState) {
            // Without TypeState, we can't determine this, so assume optional inputs can be ignored
            return false;
        }

        const functionInstance = typeState.functions.get(node.id);
        if (!functionInstance) {
            return false;
        }

        // Get the type for this input
        const inputType = functionInstance.inputs.get(inputId);
        if (!inputType) {
            // Input not in TypeState, assume it can be ignored
            return false;
        }

        // Check if the input type allows null
        // If the intersection with null is 'never', the input does not allow null and is required
        const nullIntersection = intersect(inputType, nullType);
        const allowsNull = nullIntersection.type !== 'never';

        // If the input doesn't allow null, it's required despite being marked optional
        return !allowsNull;
    };

    // Forward declaration to handle mutual recursion
    const isEffectivelyDisabled = (n: Node<NodeData>): boolean => {
        let cached = cache.get(n);
        if (cached === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            cached = isEffectivelyDisabledUncached(n);
            cache.set(n, cached);
        }
        return cached;
    };

    const isEffectivelyDisabledUncached = (n: Node<NodeData>): boolean => {
        if (n.data.isDisabled) {
            return true;
        }

        const incoming = incomingMap.get(n) ?? [];
        const schema = schemata.get(n.data.schemaId);

        // Check each incoming connection
        return incoming.some(({ source, inputId }) => {
            // Find if this input is optional
            const input = schema.inputs.find((i) => i.id === inputId);

            // If input is optional, check if it's required for the current state
            if (input?.optional) {
                // If TypeState indicates this optional input is required (doesn't allow null),
                // then propagate disabled status
                if (isOptionalInputRequired(n, inputId)) {
                    return isEffectivelyDisabled(source);
                }
                // Otherwise, ignore the disabled status of the source node
                return false;
            }

            // For required inputs, always check if the source is disabled
            return isEffectivelyDisabled(source);
        });
    };

    return nodes.filter(isEffectivelyDisabled);
};
