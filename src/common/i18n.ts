import { InitOptions } from 'i18next';
import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import hi from './locales/hi.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import ptBR from './locales/pt-BR.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import zhCN from './locales/zh-CN.json';

const resources = {
    en: { translation: en },
    es: { translation: es },
    de: { translation: de },
    fr: { translation: fr },
    it: { translation: it },
    pt: { translation: pt },
    ja: { translation: ja },
    'zh-CN': { translation: zhCN },
    ru: { translation: ru },
    ko: { translation: ko },
    nl: { translation: nl },
    pl: { translation: pl },
    tr: { translation: tr },
    ar: { translation: ar },
    hi: { translation: hi },
    'pt-BR': { translation: ptBR },
};

export const DEFAULT_OPTIONS: InitOptions = {
    resources,
    lng: 'en',
    fallbackLng: 'en',

    interpolation: {
        escapeValue: false,
    },

    returnNull: false,

    // Enable pluralization
    pluralSeparator: '_',
    contextSeparator: '_',
};
