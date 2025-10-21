import { Box, Center, ChakraProvider, ColorModeScript, Spinner } from '@chakra-ui/react';
import i18n from 'i18next';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';
import { memo, useEffect, useState } from 'react';
import { PythonInfo } from '../common/common-types';
import { ChainnerSettings } from '../common/settings/settings';
import { AlertBoxProvider } from './contexts/AlertBoxContext';
import { BackendProvider } from './contexts/BackendContext';
import { ContextMenuProvider } from './contexts/ContextMenuContext';
import { HotkeysProvider } from './contexts/HotKeyContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { useAsyncEffect } from './hooks/useAsyncEffect';
import { Main } from './main';
import { ipcRenderer } from './safeIpc';
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
    const [url, setUrl] = useState<string>();
    useAsyncEffect(
        () => ({
            supplier: () => ipcRenderer.invoke('get-backend-url'),
            successEffect: setUrl,
        }),
        []
    );

    const [settings, setSettings] = useState<ChainnerSettings>();
    useAsyncEffect(
        () => ({
            supplier: () => ipcRenderer.invoke('get-settings'),
            successEffect: setSettings,
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

    // Apply language setting immediately when settings load
    useEffect(() => {
        if (settings?.language && i18n.language !== settings.language) {
            i18n.changeLanguage(settings.language).catch(() => {
                // Fallback to English if language fails to load
                i18n.changeLanguage('en').catch(() => {
                    // ignore
                });
            });
        }
    }, [settings]);

    return (
        <ChakraProvider theme={darktheme}>
            <ColorModeScript initialColorMode={darktheme.config.initialColorMode} />
            <HotkeysProvider>
                <ContextMenuProvider>
                    <AlertBoxProvider>
                        {!url || !settings || !pythonInfo ? (
                            <LoadingComponent />
                        ) : (
                            <SettingsProvider initialSettings={settings}>
                                <BackendProvider
                                    pythonInfo={pythonInfo}
                                    url={url}
                                >
                                    <Main />
                                </BackendProvider>
                            </SettingsProvider>
                        )}
                    </AlertBoxProvider>
                </ContextMenuProvider>
            </HotkeysProvider>
        </ChakraProvider>
    );
});
