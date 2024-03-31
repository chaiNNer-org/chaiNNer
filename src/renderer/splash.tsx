import { Center, ChakraProvider, Flex, Progress, Text, VStack } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { useTranslation } from 'react-i18next';
import { ChaiNNerLogo } from './components/chaiNNerLogo';
import { ipcRenderer } from './safeIpc';
import { theme } from './splashTheme';

const Splash = memo(() => {
    const { t } = useTranslation();

    const [status, setStatus] = useState(t('splash.loading', 'Loading...'));
    const [statusProgress, setStatusProgress] = useState<null | number>(null);
    const [overallProgress, setOverallProgress] = useState(0);

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
