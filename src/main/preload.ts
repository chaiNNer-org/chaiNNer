/* eslint-disable @typescript-eslint/no-explicit-any */

import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
import type { Version } from '../common/common-types';

// Pre-load constants from the main process
const appVersion = ipcRenderer.sendSync('get-app-version-sync') as Version;
const isMac = ipcRenderer.sendSync('get-is-mac-sync') as boolean;
const isArmMac = ipcRenderer.sendSync('get-is-arm-mac-sync') as boolean;
const appDataPath = ipcRenderer.sendSync('get-appdata-sync') as string;

// Expose constants directly to the renderer
contextBridge.exposeInMainWorld('appConstants', {
    appVersion,
    isMac,
    isArmMac,
    appDataPath,
});

contextBridge.exposeInMainWorld('unsafeIpcRenderer', {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (
        channel: string,
        listener: (event: IpcRendererEvent, ...args: any[]) => void
    ): Electron.IpcRenderer => ipcRenderer.on(channel, listener),
    once: (
        channel: string,
        listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void
    ): Electron.IpcRenderer => ipcRenderer.once(channel, listener),
    postMessage: (channel: string, message: any, transfer?: MessagePort[] | undefined): void =>
        ipcRenderer.postMessage(channel, message, transfer),
    removeAllListeners: (channel: string): Electron.IpcRenderer =>
        ipcRenderer.removeAllListeners(channel),
    removeListener: (channel: string, listener: (...args: any[]) => void): Electron.IpcRenderer =>
        ipcRenderer.removeListener(channel, listener),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    send: (channel: string, ...args: any[]): void => ipcRenderer.send(channel, ...args),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    sendSync: (channel: string, ...args: any[]): any => ipcRenderer.sendSync(channel, ...args),
    sendTo: (webContentsId: number, channel: string, ...args: any[]): void =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        ipcRenderer.sendTo(webContentsId, channel, ...args),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    sendToHost: (channel: string, ...args: any[]): void => ipcRenderer.sendToHost(channel, ...args),
});
