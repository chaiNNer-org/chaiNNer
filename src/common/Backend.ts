import axios, { AxiosRequestConfig, Cancel } from 'axios';
import {
    BackendJsonNode,
    Category,
    CategoryId,
    FeatureState,
    InputId,
    InputValue,
    IterOutputTypes,
    NodeSchema,
    OutputData,
    OutputTypes,
    Package,
    PackageId,
    PackageSettings,
    PyPiName,
    PythonInfo,
    SchemaId,
    Version,
} from './common-types';
import { assertNever } from './util';

export interface BackendSuccessResponse {
    type: 'success';
}

export interface BackendLiteralErrorValue {
    type: 'literal';
    value: string | number | null;
}
export interface BackendFormattedErrorValue {
    type: 'formatted';
    formatString: string;
}
export interface BackendUnknownErrorValue {
    type: 'unknown';
    typeName: string;
    typeModule: string;
}
export interface BackendPendingErrorValue {
    type: 'pending';
}
export type BackendErrorValue =
    | BackendLiteralErrorValue
    | BackendFormattedErrorValue
    | BackendUnknownErrorValue
    | BackendPendingErrorValue;

export interface BackendExceptionSource {
    nodeId: string;
    schemaId: SchemaId;
    inputs: Partial<Record<InputId, BackendErrorValue>>;
}
export interface BackendExceptionResponse {
    type: 'error';
    message: string;
    source?: BackendExceptionSource | null;
    exception: string;
}
export interface BackendNoExecutorResponse {
    type: 'no-executor';
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
    categoriesMissingNodes: CategoryId[];
}
export interface BackendRunRequest {
    data: BackendJsonNode[];
    options: PackageSettings;
    sendBroadcastData: boolean;
}
export interface BackendRunIndividualRequest {
    id: string;
    inputs: (InputValue | null)[];
    schemaId: SchemaId;
    options: PackageSettings;
}
export interface BackendWorkerStatusResponse {
    executor: 'running' | 'killing' | 'paused' | 'ready';
}
export interface BackendStatusResponse {
    ready: boolean;
    worker: null | BackendError | BackendWorkerStatusResponse;
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

export interface ServerErrorJson {
    message: string;
    description: string;
    status: number;
}
export class ServerError extends Error {
    description: string;

    status: number;

    constructor(message: string, description: string, status: number) {
        super(message);
        this.message = message;
        this.description = description;
        this.status = status;
    }

    static isJson(json: unknown): json is ServerErrorJson {
        if (typeof json !== 'object' || json === null) {
            return false;
        }
        const obj = json as Record<string, unknown>;
        return (
            typeof obj.message === 'string' &&
            typeof obj.description === 'string' &&
            typeof obj.status === 'number'
        );
    }

    static fromJson(json: ServerErrorJson): ServerError {
        return new ServerError(json.message, json.description, json.status);
    }
}
export class CancelError extends Error {
    message: string;

    config: AxiosRequestConfig | undefined;

    constructor(message: string | undefined, config?: AxiosRequestConfig) {
        super();
        this.message = message ?? 'The request was cancelled';
        this.config = config;
    }

    static fromCancel(cancelData: Cancel, config?: AxiosRequestConfig): CancelError {
        return new CancelError(cancelData.message, config);
    }
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
    readonly url: string;

    private abortController: AbortController;

    constructor(url: string) {
        this.url = url;
        this.abortController = new AbortController();
    }

    private async fetchJson<T>(path: string, method: 'POST' | 'GET', json?: unknown): Promise<T> {
        const options: AxiosRequestConfig = {
            method,
            url: `${this.url}${path}`,
        };
        const { signal } = this.abortController;
        if (json !== undefined) {
            options.data = json;
            options.headers = {
                'Content-Type': 'application/json',
            };
            options.signal = signal;
        }

        try {
            const resp = await axios.request<T>(options);
            return resp.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const responseData = error.response?.data;
                if (ServerError.isJson(responseData)) {
                    throw ServerError.fromJson(responseData);
                }
                if (error.response?.data) {
                    return error.response.data as T;
                }
                if (axios.isCancel(error)) {
                    throw CancelError.fromCancel(error, error.config);
                }
                assertNever(error);
            }
            if (ServerError.isJson(error)) {
                throw ServerError.fromJson(error);
            }
            throw error;
        }
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

    abort(): void {
        this.abortController.abort('Aborting current execution');
        this.abortController = new AbortController();
    }

    /**
     * Clears the cache of the passed in node id
     */
    clearNodeCacheIndividual(id: string): Promise<BackendResult<null>> {
        return this.fetchJson('/clear-cache/individual', 'POST', { id });
    }

    pythonInfo(): Promise<PythonInfo> {
        return this.fetchJson('/python-info', 'GET');
    }

    systemUsage(): Promise<{ label: string; percent: number }[]> {
        return this.fetchJson('/system-usage', 'GET');
    }

    packages(): Promise<Package[]> {
        return this.fetchJson('/packages', 'GET');
    }

    installedDependencies(): Promise<Partial<Record<PyPiName, Version>>> {
        return this.fetchJson('/installed-dependencies', 'GET');
    }

    features(): Promise<FeatureState[]> {
        return this.fetchJson('/features', 'GET');
    }

    installPackages(packages: readonly PackageId[]): Promise<void> {
        return this.fetchJson('/packages/install', 'POST', { packages });
    }

    uninstallPackages(packages: readonly PackageId[]): Promise<void> {
        return this.fetchJson('/packages/uninstall', 'POST', { packages });
    }

    shutdown(): Promise<void> {
        return this.fetchJson('/shutdown', 'POST');
    }

    status(): Promise<BackendStatusResponse> {
        return this.fetchJson('/status', 'GET');
    }
}

const backendCache = new Map<string, Backend>();

/**
 * Returns a cached backend instance.
 *
 * Given the same URL, this function guarantees that the same instance is returned.
 */
export const getBackend = (url: string): Backend => {
    let instance = backendCache.get(url);
    if (instance === undefined) {
        instance = new Backend(url);
        backendCache.set(url, instance);
    }
    return instance;
};

/**
 * All possible events emitted by backend SSE along with the data layout of the event data.
 */
export interface BackendEventMap {
    'execution-error': {
        message: string;
        source?: BackendExceptionSource | null;
        exception: string;
        exceptionTrace: string;
    };
    'chain-start': {
        nodes: string[];
    };
    'node-start': {
        nodeId: string;
    };
    'node-progress': {
        nodeId: string;
        progress: number;
        index: number;
        total: number;
        eta: number;
    };
    'node-finish': {
        nodeId: string;
        executionTime: number;
    };
    'node-broadcast': {
        nodeId: string;
        data: OutputData;
        types: OutputTypes;
        sequenceTypes?: IterOutputTypes | null;
    };
    'backend-status': {
        message: string;
        progress: number;
        statusProgress?: number | null;
    };
    'package-install-status': {
        message: string;
        progress: number;
        statusProgress?: number | null;
    };
}
