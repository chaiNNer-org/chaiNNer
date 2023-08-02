import { Scope } from '@chainner/navi';
import isDeepEqual from 'fast-deep-equal';
import React, {
    MutableRefObject,
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from 'react-query';
import { createContext, useContext } from 'use-context-selector';
import { Backend, BackendNodesResponse, getBackend } from '../../common/Backend';
import { Category, PythonInfo, SchemaId } from '../../common/common-types';
import { log } from '../../common/log';
import { parseFunctionDefinitions } from '../../common/nodes/parseFunctionDefinitions';
import { ipcRenderer } from '../../common/safeIpc';
import { SchemaInputsMap } from '../../common/SchemaInputsMap';
import { SchemaMap } from '../../common/SchemaMap';
import { getChainnerScope } from '../../common/types/chainner-scope';
import { FunctionDefinition } from '../../common/types/function';
import { EMPTY_ARRAY, EMPTY_MAP, delay } from '../../common/util';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import { useIpcRendererListener } from '../hooks/useIpcRendererListener';
import { useMemoObject } from '../hooks/useMemo';
import { AlertBoxContext, AlertId, AlertType } from './AlertBoxContext';

interface BackendContextState {
    url: string;
    backend: Backend;
    ownsBackend: boolean;
    schemata: SchemaMap;
    schemaInputs: SchemaInputsMap;
    pythonInfo: PythonInfo;
    /**
     * An ordered list of all categories supported by the backend.
     *
     * Some categories might be empty.
     */
    categories: readonly Category[];
    categoriesMissingNodes: readonly string[];
    functionDefinitions: ReadonlyMap<SchemaId, FunctionDefinition>;
    scope: Scope;
    restartingRef: Readonly<React.MutableRefObject<boolean>>;
    restart: () => Promise<void>;
    connectionState: 'connecting' | 'connected' | 'failed';
}

export const BackendContext = createContext<Readonly<BackendContextState>>(
    {} as BackendContextState
);

interface BackendProviderProps {
    url: string;
    pythonInfo: PythonInfo;
}

interface NodesInfo {
    rawResponse: BackendNodesResponse;
    schemata: SchemaMap;
    categories: Category[];
    functionDefinitions: ReadonlyMap<SchemaId, FunctionDefinition>;
    categoriesMissingNodes: string[];
}

const processBackendResponse = (rawResponse: BackendNodesResponse): NodesInfo => {
    const { categories, categoriesMissingNodes, nodes } = rawResponse;

    return {
        rawResponse,
        schemata: new SchemaMap(nodes),
        categories,
        functionDefinitions: parseFunctionDefinitions(nodes),
        categoriesMissingNodes,
    };
};

const useNodes = (backend: Backend, restartingRef: Readonly<MutableRefObject<boolean>>) => {
    const isRestarting = restartingRef.current;

    const { t } = useTranslation();
    const { sendAlert, forgetAlert } = useContext(AlertBoxContext);

    const [nodesInfo, setNodesInfo] = useState<NodesInfo>();

    const [backendReady, setBackendReady] = useState(false);

    const queryClient = useQueryClient();
    const refreshNodes = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['nodes'] }).catch(log.error);
    }, [queryClient]);

    const [periodicRefresh, setPeriodicRefresh] = useState(false);
    useAsyncEffect(
        () => ({
            supplier: () => ipcRenderer.invoke('refresh-nodes'),
            successEffect: setPeriodicRefresh,
        }),
        []
    );

    const nodesQuery = useQuery({
        queryKey: ['nodes', backend.url],
        queryFn: async () => {
            try {
                // spin until we're no longer restarting
                while (restartingRef.current) {
                    // eslint-disable-next-line no-await-in-loop
                    await delay(100);
                }

                const response = await backend.nodes();
                if ('status' in response) {
                    throw new Error(`${response.message}\n${response.description}`);
                }
                return response;
            } catch (error) {
                log.error(error);
                throw error;
            }
        },
        cacheTime: 0,
        retry: 25,
        refetchOnWindowFocus: false,
        refetchInterval: periodicRefresh ? 1000 * 3 : false,
    });

    let nodeQueryError: unknown;
    if (nodesQuery.status === 'error') {
        nodeQueryError = nodesQuery.error;
    } else if (nodesQuery.failureCount > 1) {
        nodeQueryError = 'Failed to fetch backend nodes.';
    }

    const lastErrorAlert = useRef<AlertId>();
    const forgetLastErrorAlert = useCallback(() => {
        if (lastErrorAlert.current !== undefined) {
            forgetAlert(lastErrorAlert.current);
            lastErrorAlert.current = undefined;
        }
    }, [forgetAlert]);

    useEffect(() => {
        if (nodesQuery.status === 'success') {
            forgetLastErrorAlert();
            const rawResponse = nodesQuery.data;
            setNodesInfo((prev) => {
                if (isDeepEqual(prev?.rawResponse, rawResponse)) {
                    return prev;
                }

                try {
                    return processBackendResponse(rawResponse);
                } catch (e) {
                    log.error(e);
                    forgetLastErrorAlert();
                    lastErrorAlert.current = sendAlert({
                        type: AlertType.CRIT_ERROR,
                        title: t(
                            'error.title.unableToProcessNodes',
                            'Unable to process backend nodes.'
                        ),
                        message: `${t(
                            'error.message.criticalBackend',
                            'A critical error occurred while processing the node data returned by the backend.'
                        )}\n\n${String(e)}`,
                    });
                }

                return prev;
            });
        }
    }, [nodesQuery.status, nodesQuery.data, backendReady, sendAlert, forgetLastErrorAlert, t]);

    useEffect(() => {
        if (nodeQueryError && !isRestarting) {
            const message =
                nodeQueryError instanceof Error ? nodeQueryError.message : String(nodeQueryError);
            forgetLastErrorAlert();
            lastErrorAlert.current = sendAlert({
                type: AlertType.CRIT_ERROR,
                message: `${t(
                    'error.message.criticalBackend',
                    'A critical error occurred while processing the node data returned by the backend.'
                )}\n\n${t('error.error', 'Error')}: ${message}`,
            });
        }
    }, [nodeQueryError, sendAlert, forgetLastErrorAlert, t, isRestarting]);

    useIpcRendererListener('backend-ready', () => {
        // Refresh the nodes once the backend is ready
        refreshNodes();
        if (!backendReady) {
            setBackendReady(true);
            ipcRenderer.send('backend-ready');
        }
    });

    const scope = useMemo(() => {
        // function definitions all use the same scope, so just pick any one of them
        return [...(nodesInfo?.functionDefinitions.values() ?? [])][0]?.scope ?? getChainnerScope();
    }, [nodesInfo?.functionDefinitions]);
    const schemaInputs = useMemo(
        () => new SchemaInputsMap(nodesInfo?.schemata.schemata ?? []),
        [nodesInfo?.schemata]
    );

    let connectionState: 'connecting' | 'connected' | 'failed' = 'connecting';
    if (nodesQuery.status === 'success' && nodesInfo !== undefined) {
        connectionState = 'connected';
    } else if (nodesQuery.status === 'error') {
        connectionState = 'failed';
    }

    return {
        nodesInfo,
        schemaInputs,
        scope,
        refreshNodes,
        connectionState,
    };
};

export const BackendProvider = memo(
    ({ url, pythonInfo, children }: React.PropsWithChildren<BackendProviderProps>) => {
        const backend = getBackend(url);

        const [ownsBackend, setOwnsBackend] = useState<boolean>(false);
        const ownsBackendRef = useRef(ownsBackend);
        useAsyncEffect(
            () => ({
                supplier: () => ipcRenderer.invoke('owns-backend'),
                successEffect: (value) => {
                    setOwnsBackend(value);
                    ownsBackendRef.current = value;
                },
            }),
            []
        );

        const restartingRef = useRef(false);
        const restartPromiseRef = useRef<Promise<void>>();
        const needsNewRestartRef = useRef(false);

        const { nodesInfo, schemaInputs, scope, refreshNodes, connectionState } = useNodes(
            backend,
            restartingRef
        );

        const restart = useCallback((): Promise<void> => {
            if (!ownsBackendRef.current) {
                // we don't own the backend, so we can't restart it
                return Promise.resolve();
            }

            if (restartPromiseRef.current) {
                // another promise is currently restarting the backend, so we just request another restart
                needsNewRestartRef.current = true;
                return restartPromiseRef.current;
            }

            restartingRef.current = true;
            restartPromiseRef.current = (async () => {
                let error;
                try {
                    do {
                        needsNewRestartRef.current = false;
                        try {
                            backend.abort();
                            // eslint-disable-next-line no-await-in-loop
                            await ipcRenderer.invoke('restart-backend');
                            error = null;
                        } catch (e) {
                            error = e;
                        }
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    } while (needsNewRestartRef.current);
                } finally {
                    // Done. At this point, the backend either restarted or failed trying
                    restartingRef.current = false;
                    restartPromiseRef.current = undefined;
                }

                refreshNodes();

                if (error !== null) {
                    throw error instanceof Error ? error : new Error(String(error));
                }
            })();
            return restartPromiseRef.current;
        }, [backend, refreshNodes]);

        const value = useMemoObject<BackendContextState>({
            url,
            backend,
            ownsBackend,
            schemata: nodesInfo?.schemata ?? SchemaMap.EMPTY,
            schemaInputs,
            pythonInfo,
            categories: nodesInfo?.categories ?? EMPTY_ARRAY,
            categoriesMissingNodes: nodesInfo?.categoriesMissingNodes ?? EMPTY_ARRAY,
            functionDefinitions: nodesInfo?.functionDefinitions ?? EMPTY_MAP,
            scope,
            restartingRef,
            restart,
            connectionState,
        });

        return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
    }
);
