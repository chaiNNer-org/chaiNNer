import { Center, ChakraProvider, Flex, Progress, Text, VStack } from '@chakra-ui/react';
import { memo, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { useTranslation } from 'react-i18next';
import { SetupStage } from '../common/backend-setup';
import { ipcRenderer } from '../common/safeIpc';
import { assertNever } from '../common/util';
import { ChaiNNerLogo } from './components/chaiNNerLogo';
import { theme } from './splashTheme';

const Splash = memo(() => {
    const { t } = useTranslation();

    const getStatusText = useCallback(
        (stage: SetupStage): string => {
            switch (stage) {
                case 'init':
                    return t('splash.loading', 'Loading...');

                case 'checking-port':
                    return t('splash.checkingPort', 'Checking for available port...');

                case 'checking-python':
                    return t(
                        'splash.checkingPython',
                        'Checking system environment for valid Python...'
                    );
                case 'downloading-python':
                    return t('splash.downloadingPython', 'Downloading Integrated Python...');
                case 'extracting-python':
                    return t('splash.extractingPython', 'Extracting downloaded files...');

                case 'checking-ffmpeg':
                case 'downloading-ffmpeg':
                    return t('splash.downloadingFfmpeg', 'Downloading ffmpeg...');
                case 'extracting-ffmpeg':
                    return t('splash.extractingFfmpeg', 'Extracting downloaded files...');

                case 'checking-deps':
                    return t('splash.checkingDeps', 'Checking dependencies...');
                case 'installing-deps':
                    return t('splash.installingDeps', 'Installing required dependencies...');
                case 'updating-deps':
                    return t('splash.updatingDeps', 'Updating dependencies...');

                case 'spawning-backend':
                    return t('splash.startingBackend', 'Starting up backend process...');

                case 'done':
                    return t('splash.loadingApp', 'Loading main application...');

                default:
                    return assertNever(stage);
            }
        },
        [t]
    );

    const [status, setStatus] = useState(getStatusText('init'));
    const [progressPercentage, setProgressPercentage] = useState(0);
    const [overallProgressPercentage, setOverallProgressPercentage] = useState(0);
    const [showProgressBar, setShowProgressBar] = useState(false);

    // Register event listeners
    useEffect(() => {
        ipcRenderer.on(
            'splash-setup-progress',
            (event, { stage, stageProgress, totalProgress }) => {
                setOverallProgressPercentage(totalProgress);

                setShowProgressBar(stageProgress > 0);
                setProgressPercentage(stageProgress);

                setStatus(getStatusText(stage));
            }
        );
    }, [getStatusText]);

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
