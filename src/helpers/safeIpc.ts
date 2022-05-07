import {
    BrowserWindow,
    ipcMain as unsafeIpcMain,
    IpcMainEvent,
    IpcMainInvokeEvent,
    ipcRenderer as unsafeIpcRenderer,
    IpcRendererEvent,
    MessagePortMain,
    WebContents,
} from 'electron';
import { Systeminformation } from 'systeminformation';
import { PythonKeys } from '../common-types';
import { ParsedSaveData, SaveData } from './SaveFile';

interface ChannelInfo<ReturnType, Args extends unknown[] = []> {
    returnType: ReturnType;
    args: Args;
}
type SendChannelInfo<Args extends unknown[] = []> = ChannelInfo<void, Args>;

interface InvokeChannels {
    'get-gpu-name': ChannelInfo<string | null>;
    'get-has-nvidia': ChannelInfo<boolean>;
    'get-gpu-info': ChannelInfo<Systeminformation.GraphicsData>;
    'get-python': ChannelInfo<PythonKeys>;
    'get-port': ChannelInfo<number>;
    'get-localstorage-location': ChannelInfo<string>;
    'get-app-version': ChannelInfo<string>;
    'get-vram-usage': ChannelInfo<number>;
    'dir-select': ChannelInfo<Electron.OpenDialogReturnValue, [dirPath: string]>;
    'file-select': ChannelInfo<
        Electron.OpenDialogReturnValue,
        [
            filters: Electron.FileFilter[],
            allowMultiple: boolean | undefined,
            dirPath: string | undefined
        ]
    >;

    'show-warning-message-box': ChannelInfo<void, [title: string, message: string]>;
    'file-save-json': ChannelInfo<void, [saveData: SaveData, savePath: string]>;
    'file-save-as-json': ChannelInfo<
        string | undefined,
        [saveData: SaveData, savePath: string | undefined]
    >;
    'get-cli-open': ChannelInfo<ParsedSaveData | undefined>;
    'kill-backend': ChannelInfo<void>;
    'restart-backend': ChannelInfo<void>;
    'relaunch-application': ChannelInfo<void>;
    'quit-application': ChannelInfo<void>;
    'get-smi': ChannelInfo<string | undefined>;
}

interface SendChannels {
    'backend-ready': SendChannelInfo;
    'checking-deps': SendChannelInfo;
    'checking-port': SendChannelInfo;
    'checking-python': SendChannelInfo;
    'downloading-python': SendChannelInfo;
    'extracting-python': SendChannelInfo;
    'file-new': SendChannelInfo;
    'file-open': SendChannelInfo<[saveData: ParsedSaveData, openedFilePath: string]>;
    'file-save-as': SendChannelInfo;
    'file-save': SendChannelInfo;
    'finish-loading': SendChannelInfo;
    'installing-deps': SendChannelInfo;
    'installing-main-deps': SendChannelInfo;
    progress: SendChannelInfo<[percentage: number]>;
    'spawning-backend': SendChannelInfo;
    'splash-finish': SendChannelInfo;

    // history
    'history-undo': SendChannelInfo;
    'history-redo': SendChannelInfo;
    /**
     * This will strongly commit the current state of the application into its history.
     *
     * This should be used for important actions like adding/removing nodes/edges.
     */
    'history-commit': SendChannelInfo;
    /**
     * This will weakly commit the current state of the application into its history.
     *
     * A weak commit is a commit that can be overwritten by other weak commits with the same id.
     * Weak commits will always be committed if they are followed by another weak commit with a
     * different id, a strong commit, a history action (undo, redo), or another state change action
     * (save, reload, open). The implementation may also commit pending weak commits after a set
     * amount of time.
     *
     * This is useful for things like slider inputs where the user can make potentially hundreds
     * of inputs per second. By weakly committing those changes, they will only be committed to
     * history after the user is done making their inputs.
     */
    'history-commit-weak': SendChannelInfo<[id: string]>;
}
type ChannelArgs<C extends keyof (InvokeChannels & SendChannels)> = (InvokeChannels &
    SendChannels)[C]['args'];
type ChannelReturn<C extends keyof (InvokeChannels & SendChannels)> = (InvokeChannels &
    SendChannels)[C]['returnType'];

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
export const ipcRenderer = unsafeIpcRenderer as SafeIpcRenderer;
