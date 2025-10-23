import { EdgeData, InputId, NodeData } from '../common-types';
import { SchemaMap } from '../SchemaMap';
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

    // Helper to check if an optional input would make the output invalid if its source was null
    const wouldOptionalInputMakeOutputInvalid = (
        node: Node<NodeData>,
        inputId: InputId
    ): boolean => {
        if (!typeState) {
            // Without TypeState, we can't determine this, so assume optional inputs can be ignored
            return false;
        }

        const functionInstance = typeState.functions.get(node.id);
        if (!functionInstance) {
            return false;
        }

        // If there are output errors for this node, check if they're related to this input
        // Output errors indicate the node's output would be invalid (never type)
        // This suggests that missing/null inputs are causing the problem
        if (functionInstance.outputErrors.length > 0) {
            // The output has errors, which means some input is required
            // Check if this input has a non-null type assigned
            const inputType = functionInstance.inputs.get(inputId);
            // If the input has a value (non-null type), it's contributing to validation
            // If it becomes null/disabled, it could make the output invalid
            return inputType !== undefined;
        }

        return false;
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

            // If input is optional, check if it would make the output invalid
            if (input?.optional) {
                // If TypeState indicates this optional input is required for valid output,
                // then propagate disabled status
                if (wouldOptionalInputMakeOutputInvalid(n, inputId)) {
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
