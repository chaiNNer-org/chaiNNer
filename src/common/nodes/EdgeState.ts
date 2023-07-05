import { EdgeData, InputId, OutputId } from '../common-types';
import { EMPTY_MAP, parseSourceHandle, parseTargetHandle, stringifyTargetHandle } from '../util';
import type { Edge } from 'reactflow';

export interface EdgeStateConnection {
    readonly source: string;
    readonly sourceHandle: string;
    readonly target: string;
    readonly targetHandle: string;
    readonly outputId: OutputId;
    readonly inputId: InputId;
}

export class EdgeState {
    readonly byTargetHandle: ReadonlyMap<string, EdgeStateConnection>;

    readonly byTarget: ReadonlyMap<string, readonly EdgeStateConnection[]>;

    private constructor(
        byTargetHandle: EdgeState['byTargetHandle'],
        byTarget: EdgeState['byTarget']
    ) {
        this.byTargetHandle = byTargetHandle;
        this.byTarget = byTarget;
    }

    get(nodeId: string, inputId: InputId): EdgeStateConnection | undefined {
        return this.byTargetHandle.get(stringifyTargetHandle({ nodeId, inputId }));
    }

    isInputConnected(nodeId: string, inputId: InputId): boolean {
        return this.byTargetHandle.has(stringifyTargetHandle({ nodeId, inputId }));
    }

    static readonly empty = new EdgeState(EMPTY_MAP, EMPTY_MAP);

    static create(edges: readonly Edge<EdgeData>[]): EdgeState {
        const byTargetHandle = new Map<string, EdgeStateConnection>();
        const byTarget = new Map<string, EdgeStateConnection[]>();

        for (const edge of edges) {
            if (!edge.sourceHandle || !edge.targetHandle) {
                // eslint-disable-next-line no-continue
                continue;
            }

            const { outputId } = parseSourceHandle(edge.sourceHandle);
            const { inputId } = parseTargetHandle(edge.targetHandle);
            const connection: EdgeStateConnection = {
                source: edge.source,
                sourceHandle: edge.sourceHandle,
                target: edge.target,
                targetHandle: edge.targetHandle,
                outputId,
                inputId,
            };

            byTargetHandle.set(connection.targetHandle, connection);
            let list = byTarget.get(connection.target);
            if (!list) {
                list = [];
                byTarget.set(connection.target, list);
            }
            list.push(connection);
        }

        return new EdgeState(byTargetHandle, byTarget);
    }
}
