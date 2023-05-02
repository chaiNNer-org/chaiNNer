import i18n from 'i18next';
import { DEFAULT_OPTIONS } from '../common/i18n';
import { log } from '../common/log';

i18n.init(DEFAULT_OPTIONS).catch(log.error);
