import { ChannelArgs, ChannelReturn, InvokeChannels, SendChannels } from '../common/safeIpc';
// eslint-disable-next-line import/no-nodejs-modules
import type { IpcRendererEvent } from 'electron/renderer';

interface SafeIpcRenderer extends Electron.IpcRenderer {
    invoke<C extends keyof InvokeChannels>(
        channel: C,
        ...args: ChannelArgs<C>
    ): Promise<ChannelReturn<C>>;
    on<C extends keyof SendChannels>(
        channel: C,
        listener: (event: IpcRendererEvent, ...args: ChannelArgs<C>) => void
    ): this;
    once<C extends keyof SendChannels>(
        channel: C,
        listener: (event: IpcRendererEvent, ...args: ChannelArgs<C>) => void
    ): this;
    postMessage(channel: keyof SendChannels, message: unknown, transfer?: MessagePort[]): void;
    removeAllListeners(channel: keyof SendChannels): this;
    removeListener<C extends keyof SendChannels>(
        channel: C,
        listener: (event: IpcRendererEvent, ...args: ChannelArgs<C>) => void
    ): this;
    send<C extends keyof SendChannels>(channel: C, ...args: ChannelArgs<C>): void;
    sendSync<C extends keyof SendChannels>(channel: C, ...args: ChannelArgs<C>): void;
    sendTo<C extends keyof SendChannels>(
        webContentsId: number,
        channel: C,
        ...args: ChannelArgs<C>
    ): void;
    sendToHost<C extends keyof SendChannels>(channel: C, ...args: ChannelArgs<C>): void;
}

type ListenerFn = (event: IpcRendererEvent, ...args: unknown[]) => void;
const listeners = new Map<string, Set<ListenerFn>>();

export const ipcRenderer = {
    invoke: (...args) => window.unsafeIpcRenderer.invoke(...args),
    on: (channel: string, listener: ListenerFn) => {
        let channelListeners = listeners.get(channel);
        if (!channelListeners) {
            channelListeners = new Set();
            listeners.set(channel, channelListeners);
            window.unsafeIpcRenderer.on(channel, (...args) => {
                listeners.get(channel)?.forEach((l) => {
                    l(...args);
                });
            });
        }
        channelListeners.add(listener);
    },
    once: (...args) => window.unsafeIpcRenderer.once(...args),
    postMessage: (...args) => window.unsafeIpcRenderer.postMessage(...args),
    removeAllListeners: (channel: string) => {
        listeners.delete(channel);
        window.unsafeIpcRenderer.removeAllListeners(channel);
    },
    removeListener: (channel: string, listener: ListenerFn) => {
        listeners.get(channel)?.delete(listener);
    },
    send: (...args) => window.unsafeIpcRenderer.send(...args),
    sendSync: (...args) => window.unsafeIpcRenderer.sendSync(...args) as void,
    sendTo: (...args) => window.unsafeIpcRenderer.sendTo(...args),
    sendToHost: (...args) => window.unsafeIpcRenderer.sendToHost(...args),
} as SafeIpcRenderer;
