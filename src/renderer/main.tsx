import { Box, Center, Flex, HStack, Progress, Text, VStack } from '@chakra-ui/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EdgeTypes, NodeTypes, ReactFlowProvider } from 'reactflow';
import { useContext } from 'use-context-selector';
import { NodeKind } from '../common/common-types';
import { ChaiNNerLogo } from './components/chaiNNerLogo';
import { CustomEdge } from './components/CustomEdge/CustomEdge';
import { Header } from './components/Header/Header';
import { HistoryProvider } from './components/HistoryProvider';
import { BreakPoint } from './components/node/BreakPoint';
import { Node } from './components/node/Node';
import { NodeSelector } from './components/NodeSelectorPanel/NodeSelectorPanel';
import { ReactFlowBox } from './components/ReactFlowBox';
import { AlertBoxContext, AlertType } from './contexts/AlertBoxContext';
import { BackendContext } from './contexts/BackendContext';
import { DependencyProvider } from './contexts/DependencyContext';
import { ExecutionProvider } from './contexts/ExecutionContext';
import { GlobalProvider } from './contexts/GlobalNodeState';
import { NodeDocumentationProvider } from './contexts/NodeDocumentationContext';
import { useSettings } from './contexts/SettingsContext';
import { useIpcRendererListener } from './hooks/useIpcRendererListener';
import { useLastWindowSize } from './hooks/useLastWindowSize';
import { ipcRenderer } from './safeIpc';

const nodeTypes: NodeTypes & Record<NodeKind, unknown> = {
    regularNode: Node,
    newIterator: Node,
    collector: Node,
    breakPoint: BreakPoint,
};
const edgeTypes: EdgeTypes = {
    main: CustomEdge,
};

export const Main = memo(() => {
    const { t, ready } = useTranslation();
    const { sendAlert } = useContext(AlertBoxContext);
    const { connectionState, schemata, isBackendReady } = useContext(BackendContext);
    const settings = useSettings();

    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    useLastWindowSize();

    useIpcRendererListener(
        'show-collected-information',
        useCallback(
            (_, info) => {
                const fullInfo = {
                    ...info,
                    settings,
                };

                sendAlert({
                    type: AlertType.INFO,
                    title: t('alert.title.systemInformation', 'System information'),
                    message: JSON.stringify(fullInfo, undefined, 2),
                });
            },
            [sendAlert, t, settings]
        )
    );

    const [status, setStatus] = useState(t('splash.loading', 'Loading...'));
    const [statusProgress, setStatusProgress] = useState<null | number>(null);
    const [overallProgress, setOverallProgress] = useState(0);

    // Register event listeners
    useEffect(() => {
        ipcRenderer.on('setup-progress', (event, progress) => {
            setOverallProgress(progress.totalProgress);
            setStatusProgress(progress.statusProgress > 0 ? progress.statusProgress : null);

            if (progress.status) {
                setStatus(progress.status);
            }
        });
    }, []);

    useEffect(() => {
        if (isBackendReady) {
            setOverallProgress(1);
        }
    }, [isBackendReady]);

    if (connectionState === 'failed') return null;

    if (
        connectionState === 'connecting' ||
        !ready ||
        !isBackendReady ||
        schemata.schemata.length === 0
    ) {
        return (
            <Box
                h="100vh"
                w="100vw"
            >
                <Center
                    h="full"
                    w="full"
                >
                    <Flex
                        flexDirection="column"
                        w="full"
                    >
                        <Center>
                            <ChaiNNerLogo
                                percent={overallProgress * 100}
                                size={256}
                            />
                        </Center>
                        <VStack
                            bottom={0}
                            position="relative"
                            spacing={2}
                            top={8}
                            w="full"
                        >
                            <Center>
                                <Text
                                    color="gray.500"
                                    textOverflow="ellipsis"
                                >
                                    {status}
                                </Text>
                            </Center>
                            {statusProgress !== null && (
                                <Center>
                                    <Progress
                                        hasStripe
                                        value={statusProgress * 100}
                                        w="350px"
                                    />
                                </Center>
                            )}
                        </VStack>
                    </Flex>
                </Center>
            </Box>
        );
    }

    return (
        <ReactFlowProvider>
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
        </ReactFlowProvider>
    );
});
