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
import { CategoryMap } from '../../common/CategoryMap';
import {
    CategoryId,
    Feature,
    FeatureId,
    FeatureState,
    Package,
    PythonInfo,
    SchemaId,
} from '../../common/common-types';
import { log } from '../../common/log';
import { parseFunctionDefinitions } from '../../common/nodes/parseFunctionDefinitions';
import { sortNodes } from '../../common/nodes/sort';
import { SchemaInputsMap } from '../../common/SchemaInputsMap';
import { SchemaMap } from '../../common/SchemaMap';
import { getChainnerScope } from '../../common/types/chainner-scope';
import { FunctionDefinition } from '../../common/types/function';
import { EMPTY_ARRAY, EMPTY_MAP, delay } from '../../common/util';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import { useMemoObject } from '../hooks/useMemo';
import { ipcRenderer } from '../safeIpc';
import { AlertBoxContext, AlertId, AlertType } from './AlertBoxContext';

interface BackendContextState {
    url: string;
    backend: Backend;
    ownsBackend: boolean;
    schemata: SchemaMap;
    categories: CategoryMap;
    categoriesMissingNodes: readonly CategoryId[];
    schemaInputs: SchemaInputsMap;
    pythonInfo: PythonInfo;
    packages: readonly Package[];
    functionDefinitions: ReadonlyMap<SchemaId, FunctionDefinition>;
    scope: Scope;
    features: ReadonlyMap<FeatureId, Feature>;
    featureStates: ReadonlyMap<FeatureId, FeatureState>;
    refreshFeatureStates: () => Promise<void>;
    backendDownRef: React.MutableRefObject<boolean>;
    restart: () => Promise<void>;
    connectionState: 'connecting' | 'connected' | 'failed';
    isBackendReady: boolean;
}

export const BackendContext = createContext<Readonly<BackendContextState>>(
    {} as BackendContextState
);

interface BackendProviderProps {
    url: string;
    pythonInfo: PythonInfo;
}

type BackendData = [BackendNodesResponse, Package[]];
interface NodesInfo {
    rawResponse: BackendData;
    schemata: SchemaMap;
    categories: CategoryMap;
    functionDefinitions: ReadonlyMap<SchemaId, FunctionDefinition>;
    categoriesMissingNodes: CategoryId[];
    packages: Package[];
}

const processBackendResponse = (rawResponse: BackendData): NodesInfo => {
    const { categories, categoriesMissingNodes, nodes } = rawResponse[0];
    const categoryMap = new CategoryMap(categories);

    return {
        rawResponse,
        schemata: new SchemaMap(sortNodes(nodes, categoryMap)),
        categories: categoryMap,
        functionDefinitions: parseFunctionDefinitions(nodes),
        categoriesMissingNodes,
        packages: rawResponse[1],
    };
};

const useNodes = (
    backend: Backend,
    backendDownRef: Readonly<MutableRefObject<boolean>>,
    isBackendReady: boolean
) => {
    const isBackendIntentionallyDown = backendDownRef.current;

    const { t } = useTranslation();
    const { sendAlert, forgetAlert } = useContext(AlertBoxContext);

    const [nodesInfo, setNodesInfo] = useState<NodesInfo>();

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
        queryFn: async (): Promise<BackendData> => {
            try {
                // spin until we're no longer restarting
                while (!isBackendReady || backendDownRef.current) {
                    // eslint-disable-next-line no-await-in-loop
                    await delay(100);
                }

                return await Promise.all([backend.nodes(), backend.packages()]);
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
    }, [nodesQuery.status, nodesQuery.data, isBackendReady, sendAlert, forgetLastErrorAlert, t]);

    useEffect(() => {
        if (nodeQueryError && !isBackendIntentionallyDown) {
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
    }, [nodeQueryError, sendAlert, forgetLastErrorAlert, t, isBackendIntentionallyDown]);

    useEffect(() => {
        if (isBackendReady) {
            // Refresh the nodes once the backend is ready
            refreshNodes();
        }
    }, [isBackendReady, refreshNodes]);

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

const useFeatureStates = (backend: Backend) => {
    const [featureStates, setFeatureStates] = useState<readonly FeatureState[]>(EMPTY_ARRAY);

    const featuresQuery = useQuery({
        queryKey: ['features', backend.url],
        queryFn: async () => {
            try {
                return await backend.features();
            } catch (error) {
                log.error(error);
                throw error;
            }
        },
        retry: true,
        refetchOnWindowFocus: true,
        refetchInterval: 60 * 1000, // refetch every minute
    });

    const { refetch } = featuresQuery;
    const refreshFeatureStates = useCallback(async (): Promise<void> => {
        await refetch().catch(log.error);
    }, [refetch]);

    useEffect(() => {
        if (featuresQuery.status === 'success') {
            const rawResponse = featuresQuery.data;
            setFeatureStates((prev) => {
                return isDeepEqual(prev, rawResponse) ? prev : rawResponse;
            });
        }
    }, [featuresQuery.status, featuresQuery.data]);

    return {
        featureStates,
        refreshFeatureStates,
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

        const backendDownRef = useRef(false);
        const restartPromiseRef = useRef<Promise<void>>();
        const needsNewRestartRef = useRef(false);

        const [isBackendReady, setIsBackendReady] = useState(false);
        const statusQuery = useQuery({
            queryKey: ['status', backend.url],
            queryFn: async (): Promise<{ ready: boolean }> => {
                try {
                    // spin until we're no longer restarting
                    while (backendDownRef.current) {
                        // eslint-disable-next-line no-await-in-loop
                        await delay(100);
                    }

                    return await backend.status();
                } catch (error) {
                    return { ready: false };
                }
            },
            cacheTime: 0,
            retry: 25,
            refetchOnWindowFocus: true,
            refetchInterval: isBackendReady ? undefined : 1000,
        });

        useEffect(() => {
            if (statusQuery.status === 'success') {
                const { ready } = statusQuery.data;
                if (ready) {
                    setIsBackendReady(true);
                }
            }
        }, [statusQuery.status, statusQuery.data]);

        const { nodesInfo, schemaInputs, scope, refreshNodes, connectionState } = useNodes(
            backend,
            backendDownRef,
            isBackendReady
        );
        const { featureStates, refreshFeatureStates } = useFeatureStates(backend);

        const featureStatesMaps = useMemo((): ReadonlyMap<FeatureId, FeatureState> => {
            return new Map(
                featureStates.map((featureState) => [featureState.featureId, featureState])
            );
        }, [featureStates]);
        const featuresMaps = useMemo((): ReadonlyMap<FeatureId, Feature> => {
            if (nodesInfo === undefined) return EMPTY_MAP;
            return new Map(
                nodesInfo.packages
                    .flatMap((p) => p.features)
                    .map((feature) => [feature.id, feature])
            );
        }, [nodesInfo]);

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

            backendDownRef.current = true;
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
                    backendDownRef.current = false;
                    restartPromiseRef.current = undefined;
                }

                refreshNodes();
                refreshFeatureStates().catch(log.error);

                if (error !== null) {
                    throw error instanceof Error ? error : new Error(String(error));
                }
            })();
            return restartPromiseRef.current;
        }, [backend, refreshNodes, refreshFeatureStates]);

        const value = useMemoObject<BackendContextState>({
            url,
            backend,
            ownsBackend,
            schemata: nodesInfo?.schemata ?? SchemaMap.EMPTY,
            schemaInputs,
            pythonInfo,
            categories: nodesInfo?.categories ?? CategoryMap.EMPTY,
            categoriesMissingNodes: nodesInfo?.categoriesMissingNodes ?? EMPTY_ARRAY,
            packages: nodesInfo?.packages ?? EMPTY_ARRAY,
            features: featuresMaps,
            functionDefinitions: nodesInfo?.functionDefinitions ?? EMPTY_MAP,
            scope,
            featureStates: featureStatesMaps,
            refreshFeatureStates,
            backendDownRef,
            restart,
            connectionState,
            isBackendReady,
        });

        return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
    }
);
