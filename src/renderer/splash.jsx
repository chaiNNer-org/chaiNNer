import { Center, ChakraProvider, Flex, Progress, Text, VStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ipcRenderer } from '../common/safeIpc';
import ChaiNNerLogo from './components/chaiNNerLogo';
import './global.css';
import theme from './splashTheme';

function Splash() {
    const [status, setStatus] = useState('Loading...');
    const [progressPercentage, setProgressPercentage] = useState(0);
    const [overallProgressPercentage, setOverallProgressPercentage] = useState(0);
    const [showProgressBar, setShowProgressBar] = useState(false);

    // Register event listeners
    useEffect(() => {
        ipcRenderer.on('checking-port', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(0.1);
            setStatus('Checking for available port...');
        });

        ipcRenderer.on('checking-python', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(0.2);
            setStatus('Checking system environment for valid Python...');
        });

        ipcRenderer.on('checking-deps', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(0.3);
            setStatus('Checking dependencies...');
        });

        ipcRenderer.on('installing-deps', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(0.4);
            setStatus('Installing dependencies...');
        });

        ipcRenderer.on('spawning-backend', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(0.8);
            setStatus('Starting up backend process...');
        });

        ipcRenderer.on('splash-finish', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(0.9);
            setStatus('Loading main application...');
        });

        ipcRenderer.on('finish-loading', () => {
            setShowProgressBar(false);
            setOverallProgressPercentage(1);
            setStatus('Loading main application...');
        });

        ipcRenderer.on('downloading-python', () => {
            setShowProgressBar(true);
            setOverallProgressPercentage(0.5);
            setStatus('Downloading Integrated Python...');
        });

        ipcRenderer.on('extracting-python', () => {
            setShowProgressBar(true);
            setOverallProgressPercentage(0.6);
            setStatus('Extracting downloaded files...');
        });

        ipcRenderer.on('installing-main-deps', () => {
            setShowProgressBar(true);
            setOverallProgressPercentage(0.7);
            setStatus('Installing required dependencies...');
        });

        ipcRenderer.on('progress', (event, percentage) => {
            setProgressPercentage(percentage);
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
                            <Text color="gray.500">{status}</Text>
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
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Splash />);

export default Splash;
