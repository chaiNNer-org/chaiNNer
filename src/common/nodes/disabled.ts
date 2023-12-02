import { EdgeData, NodeData } from '../common-types';
import type { Edge, Node } from 'reactflow';

export enum DisabledStatus {
    Enabled,
    DirectlyDisabled,
    ParentDisabled,
    InputDisabled,
}

export const getDisabledStatus = (
    data: NodeData,
    effectivelyDisabledNodes: ReadonlySet<string>,
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
): Node<NodeData>[] => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const incomingMap = new Map<Node<NodeData>, Node<NodeData>[]>();
    for (const e of edges) {
        const source = byId.get(e.source);
        const target = byId.get(e.target);
        if (source && target) {
            let incoming = incomingMap.get(target);
            if (incoming === undefined) {
                incoming = [];
                incomingMap.set(target, incoming);
            }
            incoming.push(source);
        }
    }

    const cache = new Map<Node<NodeData>, boolean>();
    const isEffectivelyDisabledUncached = (n: Node<NodeData>): boolean => {
        if (n.data.isDisabled) {
            return true;
        }

        const incoming = incomingMap.get(n) ?? [];
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return incoming.some(isEffectivelyDisabled);
    };
    const isEffectivelyDisabled = (n: Node<NodeData>): boolean => {
        let cached = cache.get(n);
        if (cached === undefined) {
            cached = isEffectivelyDisabledUncached(n);
            cache.set(n, cached);
        }
        return cached;
    };

    return nodes.filter(isEffectivelyDisabled);
};
