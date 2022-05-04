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
import { SaveData } from './SaveFile';

interface ChannelInfo<ReturnType, Args extends unknown[] = []> {
  returnType: ReturnType;
  args: Args;
}

interface Channels {
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
  'get-cli-open': ChannelInfo<SaveData | undefined>;
  'kill-backend': ChannelInfo<void>;
  'restart-backend': ChannelInfo<void>;
  'relaunch-application': ChannelInfo<void>;
  'backend-ready': ChannelInfo<void>;
  'quit-application': ChannelInfo<void>;
  'get-smi': ChannelInfo<string | undefined>;

  // channels without a return
  'checking-deps': ChannelInfo<never>;
  'checking-port': ChannelInfo<never>;
  'checking-python': ChannelInfo<never>;
  'downloading-python': ChannelInfo<never>;
  'extracting-python': ChannelInfo<never>;
  'file-new': ChannelInfo<never>;
  'file-open': ChannelInfo<never, [saveData: SaveData, openedFilePath: string]>;
  'file-save-as': ChannelInfo<never>;
  'file-save': ChannelInfo<never>;
  'finish-loading': ChannelInfo<never>;
  'installing-deps': ChannelInfo<never>;
  'installing-main-deps': ChannelInfo<never>;
  progress: ChannelInfo<never, [percentage: number]>;
  'spawning-backend': ChannelInfo<never>;
  'splash-finish': ChannelInfo<never>;
}
type ChannelArgs<C extends keyof Channels> = Channels[C]['args'];
type ChannelReturn<C extends keyof Channels> = Channels[C]['returnType'];

interface SafeIpcMain extends Electron.IpcMain {
  handle<C extends keyof Channels>(
    channel: C,
    listener: (
      event: IpcMainInvokeEvent,
      ...args: ChannelArgs<C>
    ) => Promise<ChannelReturn<C>> | ChannelReturn<C>
  ): void;
  handleOnce<C extends keyof Channels>(
    channel: C,
    listener: (
      event: IpcMainInvokeEvent,
      ...args: ChannelArgs<C>
    ) => Promise<ChannelReturn<C>> | ChannelReturn<C>
  ): void;
  on<C extends keyof Channels>(
    channel: C,
    listener: (event: IpcMainEvent, ...args: ChannelArgs<C>) => void
  ): this;
  once<C extends keyof Channels>(
    channel: C,
    listener: (event: IpcMainEvent, ...args: ChannelArgs<C>) => void
  ): this;
  removeAllListeners(channel?: keyof Channels): this;
  removeHandler(channel: keyof Channels): void;
  removeListener<C extends keyof Channels>(
    channel: C,
    listener: (event: IpcMainEvent | IpcMainInvokeEvent, ...args: ChannelArgs<C>) => void
  ): this;
}

interface SafeIpcRenderer extends Electron.IpcRenderer {
  invoke<C extends keyof Channels>(channel: C, ...args: ChannelArgs<C>): Promise<ChannelReturn<C>>;
  on<C extends keyof Channels>(
    channel: C,
    listener: (event: IpcRendererEvent, ...args: ChannelArgs<C>) => void
  ): this;
  once<C extends keyof Channels>(
    channel: C,
    listener: (event: IpcRendererEvent, ...args: ChannelArgs<C>) => void
  ): this;
  postMessage(channel: keyof Channels, message: unknown, transfer?: MessagePort[]): void;
  removeAllListeners(channel: keyof Channels): this;
  removeListener<C extends keyof Channels>(
    channel: C,
    listener: (event: IpcRendererEvent, ...args: ChannelArgs<C>) => void
  ): this;
  send<C extends keyof Channels>(channel: C, ...args: ChannelArgs<C>): void;
  sendSync<C extends keyof Channels>(channel: C, ...args: ChannelArgs<C>): ChannelReturn<C>;
  sendTo<C extends keyof Channels>(
    webContentsId: number,
    channel: C,
    ...args: ChannelArgs<C>
  ): void;
  sendToHost<C extends keyof Channels>(channel: C, ...args: ChannelArgs<C>): void;
}

interface WebContentsWithSafeIcp extends WebContents {
  invoke<C extends keyof Channels>(channel: C, ...args: ChannelArgs<C>): Promise<ChannelReturn<C>>;
  postMessage(channel: keyof Channels, message: unknown, transfer?: MessagePortMain[]): void;
  send<C extends keyof Channels>(channel: C, ...args: ChannelArgs<C>): void;
  sendSync<C extends keyof Channels>(channel: C, ...args: ChannelArgs<C>): ChannelReturn<C>;
  sendTo<C extends keyof Channels>(
    webContentsId: number,
    channel: C,
    ...args: ChannelArgs<C>
  ): void;
  sendToHost<C extends keyof Channels>(channel: C, ...args: ChannelArgs<C>): void;
}
export interface BrowserWindowWithSafeIpc extends BrowserWindow {
  webContents: WebContentsWithSafeIcp;
}

export const ipcMain = unsafeIpcMain as SafeIpcMain;
export const ipcRenderer = unsafeIpcRenderer as SafeIpcRenderer;
