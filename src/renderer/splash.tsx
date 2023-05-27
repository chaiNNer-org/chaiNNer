import { Center, ChakraProvider, Flex, Progress, Text, VStack } from '@chakra-ui/react';
import log from 'electron-log';
import { memo, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { useTranslation } from 'react-i18next';
import { ipcRenderer } from '../common/safeIpc';
import { ChaiNNerLogo } from './components/chaiNNerLogo';
import { useAsyncEffect } from './hooks/useAsyncEffect';
import {
    useBackendEventSource,
    useBackendEventSourceListener,
} from './hooks/useBackendEventSource';
import { theme } from './splashTheme';

const Splash = memo(() => {
    const { t } = useTranslation();

    const [status, setStatus] = useState(t('splash.loading', 'Loading...'));
    const [statusProgress, setStatusProgress] = useState<null | number>(null);
    const [overallProgress, setOverallProgress] = useState(0);

    const [port, setPort] = useState<number>(8000);
    useAsyncEffect(
        () => ({ supplier: () => ipcRenderer.invoke('get-port'), successEffect: setPort }),
        []
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [eventSource, eventSourceStatus] = useBackendEventSource(port);
    useBackendEventSourceListener(eventSource, 'backend-status', (d) => {
        if (d) {
            log.info('splash backend status', d);
            if (d.message) {
                setStatus(d.message);
            }
            if (d.percent) {
                setStatusProgress(d.percent);
            }
        }
    });

    // Register event listeners
    useEffect(() => {
        ipcRenderer.on('splash-setup-progress', (event, progress) => {
            setOverallProgress(progress.totalProgress);
            setStatusProgress(progress.statusProgress > 0 ? progress.statusProgress : null);

            if (progress.status) {
                setStatus(progress.status);
            }
        });
    }, []);

    return (
        <ChakraProvider theme={theme}>
            <Center
                bg="gray.800"
                borderRadius="xl"
                color="white"
                h="400px"
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
        </ChakraProvider>
    );
});

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<Splash />);
