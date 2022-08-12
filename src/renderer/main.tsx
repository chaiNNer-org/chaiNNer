import { Box, Center, HStack, Text, VStack } from '@chakra-ui/react';
import log from 'electron-log';
import { memo, useEffect, useRef, useState } from 'react';
import { EdgeTypes, NodeTypes, ReactFlowProvider } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import useFetch, { CachePolicies } from 'use-http';
import { BackendNodesResponse } from '../common/Backend';
import { Category, SchemaId } from '../common/common-types';
import { ipcRenderer } from '../common/safeIpc';
import { SchemaMap } from '../common/SchemaMap';
import { getChainnerScope } from '../common/types/chainner-scope';
import { FunctionDefinition } from '../common/types/function';
import { getLocalStorage, getStorageKeys } from '../common/util';
import { ChaiNNerLogo } from './components/chaiNNerLogo';
import { CustomEdge } from './components/CustomEdge';
import { Header } from './components/Header';
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
import { useIpcRendererListener } from './hooks/useIpcRendererListener';
import { useLastWindowSize } from './hooks/useLastWindowSize';

interface NodesInfo {
    schemata: SchemaMap;
    categories: Category[];
    functionDefinitions: Map<SchemaId, FunctionDefinition>;
}

const processBackendResponse = ({ nodes, categories }: BackendNodesResponse): NodesInfo => {
    const schemata = new SchemaMap(nodes);

    const functionDefinitions = new Map<SchemaId, FunctionDefinition>();

    const errors: string[] = [];

    for (const schema of nodes) {
        try {
            functionDefinitions.set(
                schema.schemaId,
                FunctionDefinition.fromSchema(schema, getChainnerScope())
            );
        } catch (error) {
            errors.push(String(error));
        }
    }

    if (errors.length) {
        throw new Error(errors.join('\n\n'));
    }

    return { schemata, categories, functionDefinitions };
};

const nodeTypes: NodeTypes = {
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
    const { sendAlert } = useContext(AlertBoxContext);

    const [nodesInfo, setNodesInfo] = useState<NodesInfo | null>(null);

    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    const [backendReady, setBackendReady] = useState(false);

    const { loading, error, data, response } = useFetch<BackendNodesResponse>(
        `http://localhost:${port}/nodes`,
        { cachePolicy: CachePolicies.NO_CACHE, retries: 10 },
        [port]
    );

    useEffect(() => {
        if (response.ok && data && !loading && !error && !backendReady) {
            try {
                setNodesInfo(processBackendResponse(data));
            } catch (e) {
                log.error(e);
                sendAlert({
                    type: AlertType.CRIT_ERROR,
                    title: 'Unable to process backend nodes',
                    message:
                        `A critical error occurred while processing the node data returned by the backend.` +
                        `\n\n${String(e)}`,
                    copyToClipboard: true,
                });
            }
            setBackendReady(true);
            ipcRenderer.send('backend-ready');
        }

        if (error) {
            sendAlert(
                AlertType.CRIT_ERROR,
                null,
                `chaiNNer has encountered a critical error: ${error.message}`
            );
            setBackendReady(true);
            ipcRenderer.send('backend-ready');
        }
    }, [response, data, loading, error, backendReady]);

    useLastWindowSize();

    useIpcRendererListener(
        'show-collected-information',
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
                title: 'System information',
                message: JSON.stringify(fullInfo, undefined, 2),
                copyToClipboard: true,
            });
        },
        [sendAlert]
    );

    if (error) return null;

    if (!nodesInfo || !data) {
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
                        <Text>Loading...</Text>
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
                    functionDefinitions={nodesInfo.functionDefinitions}
                    port={port}
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
