import { EdgeData, InputId, NodeData } from '../common-types';
import { SchemaMap } from '../SchemaMap';
import { parseTargetHandle } from '../util';
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
    schemata: SchemaMap
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
            // If input is optional, ignore the disabled status of the source node
            if (input?.optional) {
                return false;
            }
            // Otherwise, check if the source is disabled
            return isEffectivelyDisabled(source);
        });
    };

    return nodes.filter(isEffectivelyDisabled);
};
