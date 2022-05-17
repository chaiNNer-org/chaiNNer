import { Box, Center, ChakraProvider, ColorModeScript, Spinner } from '@chakra-ui/react';
import { LocalStorage } from 'node-localstorage';
import { useState } from 'react';
import './global.css';
import { ipcRenderer } from '../common/safeIpc';
import { AlertBoxProvider } from './contexts/AlertBoxContext';
import { useAsyncEffect } from './hooks/useAsyncEffect';
import Main from './main';
import theme from './theme';

const App = () => {
    const [port, setPort] = useState<number | null>(null);
    const [storageInitialized, setStorageInitialized] = useState(false);

    useAsyncEffect({ supplier: () => ipcRenderer.invoke('get-port'), successEffect: setPort }, []);
    useAsyncEffect(
        {
            supplier: () => ipcRenderer.invoke('get-localstorage-location'),
            successEffect: (location) => {
                (global as Record<string, unknown>).customLocalStorage = new LocalStorage(location);
                setStorageInitialized(true);
            },
        },
        []
    );

    let Component;

    if (!port || !storageInitialized) {
        Component = () => (
            <Box
                h="full"
                w="full"
            >
                <Center
                    h="full"
                    w="full"
                >
                    <Spinner />
                </Center>
            </Box>
        );
    } else {
        Component = () => <Main port={port} />;
    }

    return (
        <ChakraProvider theme={theme}>
            <ColorModeScript initialColorMode={theme.config.initialColorMode} />
            <AlertBoxProvider>
                <Component />
            </AlertBoxProvider>
        </ChakraProvider>
    );
};

export default App;
