import { Center, ChakraProvider, Flex, Progress, Text, VStack } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { useTranslation } from 'react-i18next';
import { ipcRenderer } from '../common/safeIpc';
import { ChaiNNerLogo } from './components/chaiNNerLogo';
import { theme } from './splashTheme';

const Splash = memo(() => {
    const { t } = useTranslation();

    const [status, setStatus] = useState(t('splash.loading', 'Loading...').toString());
    const [progressPercentage, setProgressPercentage] = useState(0);
    const [overallProgressPercentage, setOverallProgressPercentage] = useState(0);
    const [showProgressBar, setShowProgressBar] = useState(false);

    // Register event listeners
    useEffect(() => {
        ipcRenderer.on('checking-port', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(0.1);
            setStatus(t('splash.checkingPort', 'Checking for available port...').toString());
        });

        ipcRenderer.on('checking-python', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(0.2);
            setStatus(
                t(
                    'splash.checkingPython',
                    'Checking system environment for valid Python...'
                ).toString()
            );
        });

        ipcRenderer.on('checking-deps', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(0.6);
            setStatus(t('splash.checkingDeps', 'Checking dependencies...').toString());
        });

        ipcRenderer.on('installing-deps', (event, onlyUpdating) => {
            setShowProgressBar(false);
            setOverallProgressPercentage(0.7);
            setStatus(
                onlyUpdating
                    ? t('splash.updatingDeps', 'Updating dependencies...').toString()
                    : t('splash.installingDeps', 'Installing required dependencies...').toString()
            );
        });

        ipcRenderer.on('spawning-backend', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(0.8);
            setStatus(t('splash.startingBackend', 'Starting up backend process...').toString());
        });

        ipcRenderer.on('splash-finish', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(0.9);
            setStatus(t('splash.loadingApp', 'Loading main application...').toString());
        });

        ipcRenderer.on('downloading-python', () => {
            setShowProgressBar(true);
            setOverallProgressPercentage(0.3);
            setStatus(t('splash.downloadingPython', 'Downloading Integrated Python...').toString());
        });

        ipcRenderer.on('extracting-python', () => {
            setShowProgressBar(true);
            setOverallProgressPercentage(0.4);
            setStatus(t('splash.extractingPython', 'Extracting downloaded files...').toString());
        });

        ipcRenderer.on('downloading-ffmpeg', () => {
            setShowProgressBar(true);
            setOverallProgressPercentage(0.5);
            setStatus(t('splash.downloadingFfmpeg', 'Downloading ffmpeg...').toString());
        });

        ipcRenderer.on('extracting-ffmpeg', () => {
            setShowProgressBar(true);
            setOverallProgressPercentage(0.6);
            setStatus(t('splash.extractingFfmpeg', 'Extracting downloaded files...').toString());
        });

        ipcRenderer.on('installing-main-deps', () => {
            setShowProgressBar(true);
            setOverallProgressPercentage(0.7);
            setStatus(t('splash.installingDeps', 'Installing required dependencies...').toString());
        });

        ipcRenderer.on('finish-loading', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(1);
            setStatus(t('splash.loadingApp', 'Loading main application...').toString());
        });

        ipcRenderer.on('progress', (event, percentage) => {
            setProgressPercentage(percentage);
        });
    }, [t]);

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
                            percent={overallProgressPercentage}
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
                        {showProgressBar && (
                            <Center>
                                <Progress
                                    hasStripe
                                    value={progressPercentage}
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
