import {
    BackendJsonNode,
    Category,
    CategoryId,
    FeatureState,
    InputId,
    InputValue,
    NodeSchema,
    OutputData,
    OutputTypes,
    Package,
    PackageSettings,
    PyPiName,
    PythonInfo,
    SchemaId,
    Version,
} from './common-types';
import { isRenderer } from './env';

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
export type BackendErrorValue =
    | BackendLiteralErrorValue
    | BackendFormattedErrorValue
    | BackendUnknownErrorValue;

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
        const options: RequestInit = isRenderer
            ? { method, cache: 'no-cache' }
            : {
                  method,
                  cache: 'no-cache',
                  //   dispatcher: new Agent({
                  //       bodyTimeout: 0,
                  //       headersTimeout: 0,
                  //   }),
              };
        const { signal } = this.abortController;
        if (json !== undefined) {
            options.body = JSON.stringify(json);
            options.headers = {
                'Content-Type': 'application/json',
            };
            options.signal = signal;
        }
        const resp = await fetch(`${this.url}${path}`, options);
        const result = (await resp.json()) as T;
        if (ServerError.isJson(result)) {
            throw ServerError.fromJson(result);
        }
        return result;
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

    installPackage(pkg: Package): Promise<void> {
        return this.fetchJson('/packages/install', 'POST', {
            package: pkg.id,
        });
    }

    uninstallPackage(pkg: Package): Promise<void> {
        return this.fetchJson('/packages/uninstall', 'POST', {
            package: pkg.id,
        });
    }

    updatePackage(pkg: Package): Promise<void> {
        return this.fetchJson('/packages/install', 'POST', {
            package: pkg.id,
        });
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
    };
    'backend-status': {
        message: string;
        progress: number;
        statusProgress?: number | null;
    };
    'backend-ready': null;
    'package-install-status': {
        message: string;
        progress: number;
        statusProgress?: number | null;
    };
}
