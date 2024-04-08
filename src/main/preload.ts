/* eslint-disable @typescript-eslint/unbound-method */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('unsafeIpcRenderer', {
    invoke: ipcRenderer.invoke,
    on: ipcRenderer.on,
    once: ipcRenderer.once,
    postMessage: ipcRenderer.postMessage,
    removeAllListeners: ipcRenderer.removeAllListeners,
    removeListener: ipcRenderer.removeListener,
    send: ipcRenderer.send,
    sendSync: ipcRenderer.sendSync,
    sendTo: ipcRenderer.sendTo,
});
