import { InitOptions } from 'i18next';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';

const resources = {
    en: { translation: en },
    es: { translation: es },
    de: { translation: de },
};

export const DEFAULT_OPTIONS: InitOptions = {
    resources,
    lng: 'en',
    fallbackLng: 'en',

    interpolation: {
        escapeValue: false,
    },

    returnNull: false,
};
