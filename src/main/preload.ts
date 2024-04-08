import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('unsafeIpcRenderer', {
    ipcRenderer: () => ipcRenderer,
});
