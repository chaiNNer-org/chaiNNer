import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { LocalStorage } from 'node-localstorage';
import path from 'path';
import { migrateOldStorageSettings } from '../common/settings/migration';
import { ChainnerSettings, defaultSettings } from '../common/settings/settings';
import { getRootDir } from './platform';

const settingsJson = path.join(getRootDir(), 'settings.json');

export const writeSettings = (settings: ChainnerSettings) => {
    writeFileSync(settingsJson, JSON.stringify(settings, null, 4), 'utf-8');
};

export const readSettings = (): ChainnerSettings => {
    if (existsSync(settingsJson)) {
        // settings.json
        return JSON.parse(readFileSync(settingsJson, 'utf-8')) as ChainnerSettings;
    }

    // legacy settings
    const storagePath = path.join(getRootDir(), 'settings');
    if (!existsSync(storagePath)) {
        // neither settings.json nor old settings exist, so this is a fresh install
        return { ...defaultSettings };
    }

    const storage = new LocalStorage(storagePath);
    const partialSettings = migrateOldStorageSettings({
        keys: Array.from({ length: storage.length }, (_, i) => storage.key(i)),
        getItem: (key: string) => storage.getItem(key),
    });
    const settings: ChainnerSettings = {
        ...defaultSettings,
        ...partialSettings,
    };

    // write a new settings.json we'll use form now on
    writeSettings(settings);
    // don't delete the old settings in case we need to revert
    renameSync(storagePath, path.join(getRootDir(), 'settings_old'));

    return settings;
};
