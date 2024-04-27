import i18n from 'i18next';
import backend from 'i18next-http-backend';
import { DEFAULT_OPTIONS } from '../common/i18n';
import { log } from '../common/log';

i18n.use(backend)
    .init({ ...DEFAULT_OPTIONS, saveMissing: true })
    .catch(log.error);
