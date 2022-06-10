import { Box, Center, HStack, Text, VStack, useColorModeValue } from '@chakra-ui/react';
import { useWindowHeight } from '@react-hook/window-size';
import log from 'electron-log';
import { memo, useEffect, useRef, useState } from 'react';
import { EdgeTypes, NodeTypes, ReactFlowProvider } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import useFetch, { CachePolicies } from 'use-http';
import { BackendNodesResponse } from '../common/Backend';
import { NodeSchema } from '../common/common-types';
import { ipcRenderer } from '../common/safeIpc';
import { SchemaMap } from '../common/SchemaMap';
import { evaluate } from '../common/types/evaluate';
import { FunctionDefinition } from '../common/types/function';
import { fromJson } from '../common/types/json';
import { TypeDefinitions } from '../common/types/typedef';
import { Type } from '../common/types/types';
import { getLocalStorage, getStorageKeys } from '../common/util';
import ChaiNNerLogo from './components/chaiNNerLogo';
import CustomEdge from './components/CustomEdge';
import Header from './components/Header';
import { HistoryProvider } from './components/HistoryProvider';
import IteratorHelperNode from './components/node/IteratorHelperNode';
import IteratorNode from './components/node/IteratorNode';
import Node from './components/node/Node';
import NodeSelector from './components/NodeSelectorPanel/NodeSelectorPanel';
import ReactFlowBox from './components/ReactFlowBox';
import { AlertBoxContext, AlertType } from './contexts/AlertBoxContext';
import { DependencyProvider } from './contexts/DependencyContext';
import { ExecutionProvider } from './contexts/ExecutionContext';
import { GlobalProvider } from './contexts/GlobalNodeState';
import { SettingsProvider } from './contexts/SettingsContext';
import { useIpcRendererListener } from './hooks/useIpcRendererListener';
import { useLastWindowSize } from './hooks/useLastWindowSize';

interface NodesInfo {
    schemata: SchemaMap;
    functionDefinitions: Map<string, FunctionDefinition>;
    typeDefinitions: TypeDefinitions;
}

const evaluateInputOutput = (
    schema: NodeSchema,
    type: 'input' | 'output',
    typeDefinitions: TypeDefinitions,
    errors: string[]
): Map<number, Type> | null => {
    const result = new Map<number, Type>();
    const startErrors = errors.length;
    for (const i of schema[`${type}s`]) {
        try {
            result.set(i.id, evaluate(fromJson(i.type), typeDefinitions));
        } catch (error) {
            errors.push(
                `Unable to evaluate type of ${schema.name} (id: ${schema.schemaId}) > ${i.label} (id: ${i.id})` +
                    `: ${String(error)}`
            );
        }
    }
    if (startErrors < errors.length) return null;
    return result;
};

const processBackendResponse = (response: BackendNodesResponse): NodesInfo => {
    const schemata = new SchemaMap(response);

    const typeDefinitions = new TypeDefinitions();
    const functionDefinitions = new Map<string, FunctionDefinition>();

    const errors: string[] = [];

    for (const schema of response) {
        const inputs = evaluateInputOutput(schema, 'input', typeDefinitions, errors);
        const outputs = evaluateInputOutput(schema, 'output', typeDefinitions, errors);

        if (inputs && outputs) {
            const fn = new FunctionDefinition(inputs, outputs, typeDefinitions);
            functionDefinitions.set(schema.schemaId, fn);
        }
    }

    if (errors.length) {
        throw new Error(errors.join('\n\n'));
    }

    return { schemata, functionDefinitions, typeDefinitions };
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

const Main = memo(({ port }: MainProps) => {
    const { sendAlert } = useContext(AlertBoxContext);

    const [nodesInfo, setNodesInfo] = useState<NodesInfo | null>(null);
    const height = useWindowHeight();

    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    const [backendReady, setBackendReady] = useState(false);

    const { loading, error, data, response } = useFetch<BackendNodesResponse>(
        `http://localhost:${port}/nodes`,
        { cachePolicy: CachePolicies.NO_CACHE, retries: 10 },
        [port]
    );

    const bgColor = useColorModeValue('gray.200', 'gray.900');

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
            <SettingsProvider port={port}>
                <GlobalProvider
                    reactFlowWrapper={reactFlowWrapper}
                    schemata={nodesInfo.schemata}
                >
                    <ExecutionProvider>
                        <DependencyProvider>
                            <HistoryProvider>
                                <VStack
                                    bg={bgColor}
                                    overflow="hidden"
                                    p={2}
                                >
                                    <Header />
                                    <HStack
                                        h={height - 80}
                                        w="full"
                                    >
                                        <NodeSelector
                                            height={height}
                                            schemata={nodesInfo.schemata}
                                        />
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
            </SettingsProvider>
        </ReactFlowProvider>
    );
});

export default Main;
