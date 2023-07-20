import { Box, Center, HStack, Text, VStack } from '@chakra-ui/react';
import isDeepEqual from 'fast-deep-equal';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from 'react-query';
import { EdgeTypes, NodeTypes, ReactFlowProvider } from 'reactflow';
import { useContext } from 'use-context-selector';
import { BackendNodesResponse, getBackend } from '../common/Backend';
import { Category, NodeType, PythonInfo, SchemaId } from '../common/common-types';
import { log } from '../common/log';
import { parseFunctionDefinitions } from '../common/nodes/parseFunctionDefinitions';
import { ipcRenderer } from '../common/safeIpc';
import { SchemaMap } from '../common/SchemaMap';
import { FunctionDefinition } from '../common/types/function';
import { getLocalStorage, getStorageKeys } from '../common/util';
import { ChaiNNerLogo } from './components/chaiNNerLogo';
import { CustomEdge } from './components/CustomEdge/CustomEdge';
import { Header } from './components/Header/Header';
import { HistoryProvider } from './components/HistoryProvider';
import { IteratorHelperNode } from './components/node/IteratorHelperNode';
import { IteratorNode } from './components/node/IteratorNode';
import { Node } from './components/node/Node';
import { NodeSelector } from './components/NodeSelectorPanel/NodeSelectorPanel';
import { ReactFlowBox } from './components/ReactFlowBox';
import { AlertBoxContext, AlertId, AlertType } from './contexts/AlertBoxContext';
import { BackendProvider } from './contexts/BackendContext';
import { DependencyProvider } from './contexts/DependencyContext';
import { ExecutionProvider } from './contexts/ExecutionContext';
import { GlobalProvider } from './contexts/GlobalNodeState';
import { NodeDocumentationProvider } from './contexts/NodeDocumentationContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { useAsyncEffect } from './hooks/useAsyncEffect';
import { useIpcRendererListener } from './hooks/useIpcRendererListener';
import { useLastWindowSize } from './hooks/useLastWindowSize';

interface NodesInfo {
    rawResponse: BackendNodesResponse;
    schemata: SchemaMap;
    categories: Category[];
    functionDefinitions: Map<SchemaId, FunctionDefinition>;
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

const nodeTypes: NodeTypes & Record<NodeType, unknown> = {
    regularNode: Node,
    iterator: IteratorNode,
    iteratorHelper: IteratorHelperNode,
};
const edgeTypes: EdgeTypes = {
    main: CustomEdge,
};

interface MainProps {
    url: string;
}

export const Main = memo(({ url }: MainProps) => {
    const { t, ready } = useTranslation();

    const { sendAlert, forgetAlert } = useContext(AlertBoxContext);

    const [nodesInfo, setNodesInfo] = useState<NodesInfo>();

    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    const [backendReady, setBackendReady] = useState(false);

    const queryClient = useQueryClient();
    const refreshNodes = useCallback(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        queryClient.invalidateQueries({ queryKey: ['nodes'] });
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
        queryKey: ['nodes', url],
        queryFn: async () => {
            try {
                const response = await getBackend(url).nodes();
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
    } else if (nodesQuery.failureCount > 0) {
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
        if (nodeQueryError) {
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
    }, [nodeQueryError, sendAlert, forgetLastErrorAlert, t]);

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

    useIpcRendererListener('backend-ready', () => {
        // Refresh the nodes once the backend is ready
        refreshNodes();
        if (!backendReady) {
            setBackendReady(true);
            ipcRenderer.send('backend-ready');
        }
    });

    useLastWindowSize();

    useIpcRendererListener(
        'show-collected-information',
        useCallback(
            (_, info) => {
                const localStorage = getLocalStorage();
                const fullInfo = {
                    ...info,
                    settings: Object.fromEntries(
                        getStorageKeys(localStorage).map((k) => [k, localStorage.getItem(k)])
                    ),
                };

                sendAlert({
                    type: AlertType.INFO,
                    title: t('alert.title.systemInformation', 'System information'),
                    message: JSON.stringify(fullInfo, undefined, 2),
                });
            },
            [sendAlert, t]
        )
    );

    const [pythonInfo, setPythonInfo] = useState<PythonInfo>();
    useAsyncEffect(
        () => ({
            supplier: () => ipcRenderer.invoke('get-python'),
            successEffect: setPythonInfo,
        }),
        []
    );

    if (nodesQuery.isError) return null;

    if (!nodesInfo || !pythonInfo || !ready) {
        return (
            <Box
                h="100vh"
                w="100vw"
            >
                <Center
                    h="full"
                    w="full"
                >
                    <VStack>
                        <ChaiNNerLogo
                            percent={0}
                            size={256}
                        />
                        <Text>{t('loading', 'Loading...')}</Text>
                    </VStack>
                </Center>
            </Box>
        );
    }

    return (
        <ReactFlowProvider>
            <SettingsProvider>
                <BackendProvider
                    categories={nodesInfo.categories}
                    categoriesMissingNodes={nodesInfo.categoriesMissingNodes}
                    functionDefinitions={nodesInfo.functionDefinitions}
                    pythonInfo={pythonInfo}
                    refreshNodes={refreshNodes}
                    schemata={nodesInfo.schemata}
                    url={url}
                >
                    <GlobalProvider reactFlowWrapper={reactFlowWrapper}>
                        <NodeDocumentationProvider>
                            <ExecutionProvider>
                                <DependencyProvider>
                                    <HistoryProvider>
                                        <VStack
                                            bg="var(--window-bg)"
                                            h="100vh"
                                            overflow="hidden"
                                            p={2}
                                            w="100vw"
                                        >
                                            <Header />
                                            <HStack
                                                h="calc(100vh - 80px)"
                                                minH="360px"
                                                minW="720px"
                                                w="full"
                                            >
                                                <NodeSelector />
                                                <ReactFlowBox
                                                    edgeTypes={edgeTypes}
                                                    nodeTypes={nodeTypes}
                                                    wrapperRef={reactFlowWrapper}
                                                />
                                            </HStack>
                                        </VStack>
                                    </HistoryProvider>
                                </DependencyProvider>
                            </ExecutionProvider>
                        </NodeDocumentationProvider>
                    </GlobalProvider>
                </BackendProvider>
            </SettingsProvider>
        </ReactFlowProvider>
    );
});
