import { Edge, Node } from 'react-flow-renderer';
import { EdgeData, NodeData } from '../../common/common-types';

export type DisabledStatus =
    | { readonly isDisabled: true; readonly directly: boolean; readonly reason: string }
    | { readonly isDisabled: false };

export const getDisabledStatus = (
    data: NodeData,
    effectivelyDisabledNodes: ReadonlySet<string>
): DisabledStatus => {
    if (data.isDisabled) {
        return {
            isDisabled: true,
            directly: true,
            reason: 'This node is disabled and will not be executed.',
        };
    }
    if (data.parentNode && effectivelyDisabledNodes.has(data.parentNode)) {
        return {
            isDisabled: true,
            directly: false,
            reason: 'This node will not be executed because its parent iterator node is disabled.',
        };
    }
    if (effectivelyDisabledNodes.has(data.id)) {
        return {
            isDisabled: true,
            directly: false,
            reason: 'This node is indirectly disabled because at least one of its inputs is disabled and will not be executed.',
        };
    }
    return { isDisabled: false };
};

export const getEffectivelyDisabledNodes = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[]
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

        const parent = byId.get(n.data.parentNode!);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        if (parent && isEffectivelyDisabled(parent)) return true;

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
