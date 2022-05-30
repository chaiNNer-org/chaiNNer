import { PythonInfo } from './common-types';
import { isRenderer } from './env';
import { ipcRenderer } from './safeIpc';

let info: Promise<PythonInfo> | undefined;

export const setPythonInfo = (k: PromiseLike<PythonInfo> | PythonInfo): void => {
    info = Promise.resolve(k);
};

export const getPythonInfo = (): Promise<PythonInfo> => {
    if (!info) {
        if (isRenderer) {
            info = ipcRenderer.invoke('get-python');
            return info;
        }

        return Promise.reject(
            new Error(
                'No python info available. The main process must call `setPythonInfo` before calling any function that uses `getPythonInfo`.'
            )
        );
    }
    return info;
};
