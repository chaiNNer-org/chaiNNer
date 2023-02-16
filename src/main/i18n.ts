import log from 'electron-log';
import i18n from 'i18next';
import { DEFAULT_OPTIONS } from '../common/i18n';

i18n.init(DEFAULT_OPTIONS).catch((err) => {
    log.error(err);
});
