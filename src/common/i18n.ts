import { InitOptions } from 'i18next';
import de from './locales/de/translation.json';
import en from './locales/en/translation.json';
import es from './locales/es/translation.json';

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
