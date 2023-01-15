import { app } from 'electron';
import { LocalStorage } from 'node-localstorage';
import path from 'path';

export const settingStorageLocation = path.join(app.getPath('userData'), 'settings');

interface ReadonlyStorage {
    /** Returns the current value associated with the given key, or null if the given key does not exist. */
    getItem(key: string): string | null;
}

export const settingStorage: ReadonlyStorage = new LocalStorage(settingStorageLocation);
