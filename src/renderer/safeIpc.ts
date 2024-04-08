import { IpcRendererEvent } from 'electron'; // TODO: replace with electron/renderer
import { ChannelArgs, ChannelReturn, InvokeChannels, SendChannels } from '../common/safeIpc';

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

export const ipcRenderer = window.unsafeIpcRenderer as SafeIpcRenderer;
