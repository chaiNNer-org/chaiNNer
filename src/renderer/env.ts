import { ipcRenderer } from './safeIpc';

export const getCacheLocation = (userDataPath: string, cacheKey: string) => {
    return ipcRenderer.invoke('path-join', userDataPath, '/cache/', cacheKey);
};
