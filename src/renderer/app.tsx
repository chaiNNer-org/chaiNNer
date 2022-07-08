import { Box, Center, ChakraProvider, ColorModeScript, Spinner } from '@chakra-ui/react';
import { LocalStorage } from 'node-localstorage';
import { memo, useState } from 'react';
import './global.css';
import { ipcRenderer } from '../common/safeIpc';
import { AlertBoxProvider } from './contexts/AlertBoxContext';
import { ContextMenuProvider } from './contexts/ContextMenuContext';
import { useAsyncEffect } from './hooks/useAsyncEffect';
import { Main } from './main';
import { theme } from './theme';

const LoadingComponent = memo(() => (
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
));

const MainComponent = memo(({ port }: { port: number }) => <Main port={port} />);

export const App = memo(() => {
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

    return (
        <ChakraProvider theme={theme}>
            <ColorModeScript initialColorMode={theme.config.initialColorMode} />
            <ContextMenuProvider>
                <AlertBoxProvider>
                    {!port || !storageInitialized ? (
                        <LoadingComponent />
                    ) : (
                        <MainComponent port={port} />
                    )}
                </AlertBoxProvider>
            </ContextMenuProvider>
        </ChakraProvider>
    );
});
