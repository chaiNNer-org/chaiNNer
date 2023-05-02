import { Box, Center, HStack, Text, VStack } from '@chakra-ui/react';
import isDeepEqual from 'fast-deep-equal';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EdgeTypes, NodeTypes, ReactFlowProvider } from 'reactflow';
import { useContext } from 'use-context-selector';
import useFetch, { CachePolicies } from 'use-http';
import { BackendNodesResponse } from '../common/Backend';
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
import { AlertBoxContext, AlertType } from './contexts/AlertBoxContext';
import { BackendProvider } from './contexts/BackendContext';
import { DependencyProvider } from './contexts/DependencyContext';
import { ExecutionProvider } from './contexts/ExecutionContext';
import { GlobalProvider } from './contexts/GlobalNodeState';
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
    port: number;
}

export const Main = memo(({ port }: MainProps) => {
    const { t, ready } = useTranslation();

    const { sendAlert } = useContext(AlertBoxContext);

    const [nodesInfo, setNodesInfo] = useState<NodesInfo>();

    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    const [backendReady, setBackendReady] = useState(false);
    const [nodesRefreshCounter, setNodesRefreshCounter] = useState(0);
    const refreshNodes = useCallback(() => setNodesRefreshCounter((prev) => prev + 1), []);

    const { loading, error, data, response } = useFetch<BackendNodesResponse>(
        `http://localhost:${port}/nodes`,
        { cachePolicy: CachePolicies.NO_CACHE, cache: 'no-cache', retries: 25 },
        [port, nodesRefreshCounter]
    );

    useEffect(() => {
        if (error) {
            sendAlert({
                type: AlertType.CRIT_ERROR,
                message: `${t(
                    'error.message.criticalBackend',
                    'A critical error occurred while processing the node data returned by the backend.'
                )} ${t('error.error', 'Error')}: ${error.message}`,
            });
        }
    }, [error, sendAlert, t]);

    useEffect(() => {
        if (loading) {
            return;
        }

        if (response.ok && data && !error) {
            const rawResponse = data;
            setNodesInfo((prev) => {
                if (isDeepEqual(prev?.rawResponse, rawResponse)) {
                    return prev;
                }

                try {
                    return processBackendResponse(rawResponse);
                } catch (e) {
                    log.error(e);
                    sendAlert({
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

        if (!backendReady) {
            setBackendReady(true);
            ipcRenderer.send('backend-ready');
        }
    }, [response, data, loading, error, backendReady, sendAlert, t]);

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

    if (error) return null;

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
                    port={port}
                    pythonInfo={pythonInfo}
                    refreshNodes={refreshNodes}
                    schemata={nodesInfo.schemata}
                >
                    <GlobalProvider reactFlowWrapper={reactFlowWrapper}>
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
                    </GlobalProvider>
                </BackendProvider>
            </SettingsProvider>
        </ReactFlowProvider>
    );
});
