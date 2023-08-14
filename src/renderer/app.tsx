import { Box, Center, ChakraProvider, ColorModeScript, Spinner } from '@chakra-ui/react';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';
import { LocalStorage } from 'node-localstorage';
import { memo, useState } from 'react';
import { PythonInfo } from '../common/common-types';
import { ipcRenderer } from '../common/safeIpc';
import { AlertBoxProvider } from './contexts/AlertBoxContext';
import { BackendProvider } from './contexts/BackendContext';
import { ContextMenuProvider } from './contexts/ContextMenuContext';
import { HotkeysProvider } from './contexts/HotKeyContext';
import { useAsyncEffect } from './hooks/useAsyncEffect';
import { Main } from './main';
import { darktheme } from './theme';
import './i18n';

TimeAgo.addLocale(en);
TimeAgo.setDefaultLocale(en.locale);

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

export const App = memo(() => {
    const [url, setUrl] = useState<string | null>(null);
    const [storageInitialized, setStorageInitialized] = useState(false);

    useAsyncEffect(
        () => ({ supplier: () => ipcRenderer.invoke('get-backend-url'), successEffect: setUrl }),
        []
    );
    useAsyncEffect(
        () => ({
            supplier: () => ipcRenderer.invoke('get-localstorage-location'),
            successEffect: (location) => {
                (global as Record<string, unknown>).customLocalStorage = new LocalStorage(location);
                setStorageInitialized(true);
            },
        }),
        []
    );

    const [pythonInfo, setPythonInfo] = useState<PythonInfo>();
    useAsyncEffect(
        () => ({
            supplier: () => ipcRenderer.invoke('get-python'),
            successEffect: setPythonInfo,
        }),
        []
    );

    return (
        <ChakraProvider theme={darktheme}>
            <ColorModeScript initialColorMode={darktheme.config.initialColorMode} />
            <HotkeysProvider>
                <ContextMenuProvider>
                    <AlertBoxProvider>
                        {!url || !storageInitialized || !pythonInfo ? (
                            <LoadingComponent />
                        ) : (
                            <BackendProvider
                                pythonInfo={pythonInfo}
                                url={url}
                            >
                                <Main />
                            </BackendProvider>
                        )}
                    </AlertBoxProvider>
                </ContextMenuProvider>
            </HotkeysProvider>
        </ChakraProvider>
    );
});
