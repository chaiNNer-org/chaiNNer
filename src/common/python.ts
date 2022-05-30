import { PythonKeys } from './common-types';
import { isRenderer } from './env';
import { ipcRenderer } from './safeIpc';

let keys: Promise<PythonKeys> | undefined;

export const setPythonKeys = (k: PromiseLike<PythonKeys> | PythonKeys): void => {
    keys = Promise.resolve(k);
};

export const getPythonKeys = (): Promise<PythonKeys> => {
    if (!keys) {
        if (isRenderer) {
            keys = ipcRenderer.invoke('get-python');
            return keys;
        }

        return Promise.reject(
            new Error(
                'No python keys available. The main process must call `setPythonKeys` before calling any function that uses `getPythonKeys`.'
            )
        );
    }
    return keys;
};
