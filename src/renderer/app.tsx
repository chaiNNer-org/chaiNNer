import { Box, Center, ChakraProvider, ColorModeScript, Spinner } from '@chakra-ui/react';
import i18n from 'i18next';
import TimeAgo from 'javascript-time-ago';
import de from 'javascript-time-ago/locale/de.json';
import en from 'javascript-time-ago/locale/en.json';
import es from 'javascript-time-ago/locale/es.json';
import fr from 'javascript-time-ago/locale/fr.json';
import hi from 'javascript-time-ago/locale/hi.json';
import it from 'javascript-time-ago/locale/it.json';
import ja from 'javascript-time-ago/locale/ja.json';
import ko from 'javascript-time-ago/locale/ko.json';
import nl from 'javascript-time-ago/locale/nl.json';
import pl from 'javascript-time-ago/locale/pl.json';
import pt from 'javascript-time-ago/locale/pt.json';
import ru from 'javascript-time-ago/locale/ru.json';
import tr from 'javascript-time-ago/locale/tr.json';
import zh from 'javascript-time-ago/locale/zh.json';
import { memo, useLayoutEffect, useState } from 'react';
import { PythonInfo } from '../common/common-types';
import { normalizeLanguage } from '../common/i18n';
import { log } from '../common/log';
import { ChainnerSettings } from '../common/settings/settings';
import { AlertBoxProvider } from './contexts/AlertBoxContext';
import { BackendProvider } from './contexts/BackendContext';
import { ContextMenuProvider } from './contexts/ContextMenuContext';
import { HotkeysProvider } from './contexts/HotKeyContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { useAsyncEffect } from './hooks/useAsyncEffect';
import { useSettings } from './hooks/useSettings';
import { Main } from './main';
import { ipcRenderer } from './safeIpc';
import { darktheme } from './theme';
import './i18n';

// One per shipped UI language; pt-BR and zh-CN resolve to pt and zh.
for (const locale of [en, de, es, fr, hi, it, ja, ko, nl, pl, pt, ru, tr, zh]) {
    TimeAgo.addLocale(locale);
}
TimeAgo.setDefaultLocale(en.locale);

// Applies the language setting on start and whenever it changes. Components
// using useTranslation re-render with the new language.
const LanguageSync = memo(() => {
    const { language } = useSettings();
    useLayoutEffect(() => {
        i18n.changeLanguage(normalizeLanguage(language)).catch(log.error);
    }, [language]);
    return null;
});

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
                                <LanguageSync />
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
