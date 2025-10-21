import i18n from 'i18next';
import backend from 'i18next-http-backend';
import { DEFAULT_OPTIONS } from '../common/i18n';
import { log } from '../common/log';
import { readSettings } from './setting-storage';

// Load settings to get the language preference
let language = 'en';
try {
    const settings = readSettings();
    language = settings.language || 'en';
} catch (error) {
    log.warn('Failed to load settings for i18n, using default language');
}

i18n.use(backend)
    .init({ ...DEFAULT_OPTIONS, lng: language, saveMissing: true })
    .catch(log.error);
