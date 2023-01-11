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

    const [status, setStatus] = useState(t('splash.loading', 'Loading...'));
    const [progressPercentage, setProgressPercentage] = useState(0);
    const [overallProgressPercentage, setOverallProgressPercentage] = useState(0);
    const [showProgressBar, setShowProgressBar] = useState(false);

    // Register event listeners
    useEffect(() => {
        ipcRenderer.on('splash-setup-progress', (event, progress) => {
            setOverallProgressPercentage(progress.totalProgress);

            setShowProgressBar(progress.statusProgress > 0);
            setProgressPercentage(progress.statusProgress);

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
