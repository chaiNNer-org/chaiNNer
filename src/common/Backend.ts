import fetch from 'cross-fetch';
import { Category, InputId, InputValue, JsonNode, NodeSchema, SchemaId } from './common-types';

export interface BackendSuccessResponse {
    type: 'success';
    message: string;
}
export interface BackendExceptionSource {
    nodeId: string;
    schemaId: SchemaId;
    inputs: Partial<
        Record<
            InputId,
            { width: number; height: number; channels: number } | string | number | null
        >
    >;
}
export interface BackendExceptionResponse {
    type: 'error';
    message: string;
    source?: BackendExceptionSource | null;
    exception: string;
}
export interface BackendNoExecutorResponse {
    type: 'no-executor';
    message: string;
}
export interface BackendAlreadyRunningResponse {
    type: 'already-running';
    message: string;
}
export type BackendExecutorActionResponse =
    | BackendSuccessResponse
    | BackendExceptionResponse
    | BackendNoExecutorResponse;
export interface BackendNodesResponse {
    nodes: NodeSchema[];
    categories: Category[];
    categoriesMissingNodes: string[];
}
export interface BackendRunRequest {
    data: JsonNode[];
    isCpu: boolean;
    isFp16: boolean;
    pytorchGPU: number;
    ncnnGPU: number;
    onnxGPU: number;
    onnxExecutionProvider: string;
}
export interface BackendRunIndividualRequest {
    id: string;
    inputs: (InputValue | null)[];
    isCpu: boolean;
    isFp16: boolean;
    pytorchGPU: number;
    ncnnGPU: number;
    onnxGPU: number;
    onnxExecutionProvider: string;
    schemaId: SchemaId;
}

export type BackendResult<T> = BackendSuccess<T> | BackendError;
export interface BackendSuccess<T> {
    success: true;
    data: T;
}
export interface BackendError {
    success: false;
    error: string;
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
    run(
        data: BackendRunRequest
    ): Promise<BackendSuccessResponse | BackendExceptionResponse | BackendAlreadyRunningResponse> {
        return this.fetchJson('/run', 'POST', data);
    }

    /**
     * Runs a single node
     */
    runIndividual(data: BackendRunIndividualRequest): Promise<BackendResult<null>> {
        return this.fetchJson('/run/individual', 'POST', data);
    }

    pause(): Promise<BackendExecutorActionResponse> {
        return this.fetchJson('/pause', 'POST');
    }

    resume(): Promise<BackendExecutorActionResponse> {
        return this.fetchJson('/resume', 'POST');
    }

    kill(): Promise<BackendExecutorActionResponse> {
        return this.fetchJson('/kill', 'POST');
    }

    /**
     * Clears the cache of the passed in node id
     */
    clearNodeCacheIndividual(id: string): Promise<BackendResult<null>> {
        return this.fetchJson('/clearcache/individual', 'POST', { id });
    }

    /**
     * Gets a list of all NCNN GPU devices and their indexes
     */
    listNcnnGpus(): Promise<string[]> {
        return this.fetchJson('/listgpus/ncnn', 'GET');
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
