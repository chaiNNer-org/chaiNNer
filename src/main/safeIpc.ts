import {
    BrowserWindow,
    IpcMainEvent,
    IpcMainInvokeEvent,
    MessagePortMain,
    WebContents,
    ipcMain as unsafeIpcMain,
} from 'electron/main';
import { ChannelArgs, ChannelReturn, InvokeChannels, SendChannels } from '../common/safeIpc';

interface SafeIpcMain extends Electron.IpcMain {
    handle<C extends keyof InvokeChannels>(
        channel: C,
        listener: (
            event: IpcMainInvokeEvent,
            ...args: ChannelArgs<C>
        ) => Promise<ChannelReturn<C>> | ChannelReturn<C>
    ): void;
    handleOnce<C extends keyof InvokeChannels>(
        channel: C,
        listener: (
            event: IpcMainInvokeEvent,
            ...args: ChannelArgs<C>
        ) => Promise<ChannelReturn<C>> | ChannelReturn<C>
    ): void;
    on<C extends keyof SendChannels>(
        channel: C,
        listener: (event: IpcMainEvent, ...args: ChannelArgs<C>) => void
    ): this;
    once<C extends keyof SendChannels>(
        channel: C,
        listener: (event: IpcMainEvent, ...args: ChannelArgs<C>) => void
    ): this;
    removeAllListeners(channel?: keyof SendChannels): this;
    removeHandler(channel: keyof InvokeChannels): void;
    removeListener<C extends keyof SendChannels>(
        channel: C,
        listener: (event: IpcMainEvent | IpcMainInvokeEvent, ...args: ChannelArgs<C>) => void
    ): this;
}

interface WebContentsWithSafeIcp extends WebContents {
    invoke<C extends keyof SendChannels>(
        channel: C,
        ...args: ChannelArgs<C>
    ): Promise<ChannelReturn<C>>;
    postMessage(channel: keyof SendChannels, message: unknown, transfer?: MessagePortMain[]): void;
    send<C extends keyof SendChannels>(channel: C, ...args: ChannelArgs<C>): void;
    sendSync<C extends keyof SendChannels>(channel: C, ...args: ChannelArgs<C>): ChannelReturn<C>;
    sendTo<C extends keyof SendChannels>(
        webContentsId: number,
        channel: C,
        ...args: ChannelArgs<C>
    ): void;
    sendToHost<C extends keyof SendChannels>(channel: C, ...args: ChannelArgs<C>): void;
}

export interface BrowserWindowWithSafeIpc extends BrowserWindow {
    webContents: WebContentsWithSafeIcp;
}

export const ipcMain = unsafeIpcMain as SafeIpcMain;
