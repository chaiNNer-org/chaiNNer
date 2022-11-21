import log from 'electron-log';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../common/locales/en/translation.json';

const resources = {
    en,
};

i18n.use(initReactI18next)
    .init({
        resources,
        lng: 'en',

        interpolation: {
            escapeValue: false,
        },
    })
    .catch((err) => {
        log.error(err);
    });

export { i18n };
