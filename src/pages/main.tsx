import { Box, Center, HStack, Text, useColorModeValue, VStack } from '@chakra-ui/react';
import { useWindowHeight } from '@react-hook/window-size';
import { memo, useEffect, useRef, useState } from 'react';
import { EdgeTypes, NodeTypes, ReactFlowProvider } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import useFetch, { CachePolicies } from 'use-http';
import ChaiNNerLogo from '../components/chaiNNerLogo';
import CustomEdge from '../components/CustomEdge';
import Header from '../components/Header';
import IteratorHelperNode from '../components/node/IteratorHelperNode';
import IteratorNode from '../components/node/IteratorNode';
import Node from '../components/node/Node';
import NodeSelector from '../components/NodeSelectorPanel/NodeSelectorPanel';
import ReactFlowBox from '../components/ReactFlowBox';
import { BackendNodesResponse } from '../helpers/Backend';
import { AlertBoxContext, AlertType } from '../helpers/contexts/AlertBoxContext';
import { ExecutionProvider } from '../helpers/contexts/ExecutionContext';
import { GlobalProvider } from '../helpers/contexts/GlobalNodeState';
import { MenuFunctionsProvider } from '../helpers/contexts/MenuFunctions';
import { SettingsProvider } from '../helpers/contexts/SettingsContext';
import { ipcRenderer } from '../helpers/safeIpc';
import { SchemaMap } from '../helpers/SchemaMap';

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

const Main = ({ port }: MainProps) => {
    const { sendAlert } = useContext(AlertBoxContext);

    const [schemata, setSchemata] = useState<SchemaMap | null>(null);
    const height = useWindowHeight();

    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    const [backendReady, setBackendReady] = useState(false);

    const { loading, error, data, response } = useFetch<BackendNodesResponse>(
        `http://localhost:${port}/nodes`,
        { cachePolicy: CachePolicies.NO_CACHE, retries: 10 },
        [port]
    );

    const bgColor = useColorModeValue('gray.200', '#151a24');

    useEffect(() => {
        if (response.ok && data && !loading && !error && !backendReady) {
            setSchemata(new SchemaMap(data));
            setBackendReady(true);
            ipcRenderer.send('backend-ready');
        }
    }, [response, data, loading, error, backendReady]);

    const loadingLogo = (
        <ChaiNNerLogo
            percent={0}
            size={256}
        />
    );

    if (error) {
        sendAlert(
            AlertType.CRIT_ERROR,
            null,
            `chaiNNer has encountered a critical error: ${error.message}`
        );
        return <></>;
    }

    if (!schemata || !data) {
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
                        {loadingLogo}
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
                    schemata={schemata}
                >
                    <MenuFunctionsProvider>
                        <VStack
                            bg={bgColor}
                            overflow="hidden"
                            p={2}
                        >
                            <ExecutionProvider>
                                <Header />
                            </ExecutionProvider>
                            <HStack
                                h={height - 80}
                                w="full"
                            >
                                <NodeSelector
                                    height={height}
                                    schemata={schemata}
                                />
                                <ReactFlowBox
                                    edgeTypes={edgeTypes}
                                    nodeTypes={nodeTypes}
                                    wrapperRef={reactFlowWrapper}
                                />
                            </HStack>
                        </VStack>
                    </MenuFunctionsProvider>
                </GlobalProvider>
            </SettingsProvider>
        </ReactFlowProvider>
    );
};

export default memo(Main);
