import { InitOptions } from 'i18next';
import en from './locales/en/translation.json';

const resources = {
    en,
};

export const DEFAULT_OPTIONS: InitOptions = {
    resources,
    lng: 'en',

    interpolation: {
        escapeValue: false,
    },

    returnNull: false,
};
