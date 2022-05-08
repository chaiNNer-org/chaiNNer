import fetch from 'cross-fetch';
import { InputValue, JsonValue, NodeSchema, UsableData } from '../common-types';

export interface BackendSuccessResponse {
    message: string;
    exception?: never;
}
export interface BackendExceptionResponse {
    message: string;
    exception: string;
}
export type BackendNodesResponse = NodeSchema[];
export interface BackendRunRequest {
    data: Record<string, UsableData>;
    isCpu: boolean;
    isFp16: boolean;
}
export interface BackendRunIndividualRequest {
    id: string;
    category: string;
    node: string;
    inputs: InputValue[];
    isCpu: boolean;
    isFp16: boolean;
    identifier: string;
}

/**
 * A wrapper to communicate with the backend.
 *
 * All methods have the following properties:
 *
 * - They will never throw and return a promise.
 * - The promise will parse the data from the backend as JSON and resolve no matter the
 *   status code.
 * - If the backend returns invalid JSON, the promise will reject.
 * - If the backend is not reachable, the promise will reject.
 */
export class Backend {
    readonly port: number;

    constructor(port: number) {
        this.port = port;
    }

    private async fetchJson<T>(path: string, method: 'POST' | 'GET', json?: unknown): Promise<T> {
        const options: RequestInit = { method, cache: 'no-cache' };
        if (json !== undefined) {
            options.body = JSON.stringify(json);
            options.headers = {
                'Content-Type': 'application/json',
            };
        }

        const resp = await fetch(`http://localhost:${this.port}${path}`, options);
        return (await resp.json()) as T;
    }

    /**
     * Gets a list of all nodes as well as the node information
     */
    nodes(): Promise<BackendNodesResponse> {
        return this.fetchJson('/nodes', 'GET');
    }

    /**
     * Runs the provided nodes
     */
    run(data: BackendRunRequest): Promise<BackendSuccessResponse | BackendExceptionResponse> {
        return this.fetchJson('/run', 'POST', data);
    }

    /**
     * Runs a single node
     */
    runIndividual<T = JsonValue>(data: BackendRunIndividualRequest): Promise<T> {
        return this.fetchJson('/run/individual', 'POST', data);
    }

    /**
     * Pauses the current execution
     */
    pause(): Promise<BackendSuccessResponse | BackendExceptionResponse> {
        return this.fetchJson('/pause', 'POST');
    }

    /**
     * Kills the current execution
     */
    async kill(): Promise<BackendSuccessResponse | BackendExceptionResponse> {
        return this.fetchJson('/kill', 'POST');
    }
}

const backendCache = new Map<number, Backend>();

/**
 * Returns a cached backend instance.
 *
 * Given the same port, this function guarantees that the same instance is returned.
 */
export const getBackend = (port: number): Backend => {
    if (!Number.isInteger(port) || port < 0 || port >= 65536) {
        // all invalid ports should map to the same instance
        // eslint-disable-next-line no-param-reassign
        port = NaN;
    }

    let instance = backendCache.get(port);
    if (instance === undefined) {
        instance = new Backend(port);
        backendCache.set(port, instance);
    }
    return instance;
};
