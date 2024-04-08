import { type FileFilter, type OpenDialogReturnValue } from 'electron'; // TODO: replace with electron/common
import { MakeDirectoryOptions } from 'fs';
import { Mode, ObjectEncodingOptions, OpenMode, PathLike } from 'original-fs';
import { FileOpenResult, FileSaveResult, PythonInfo, Version } from './common-types';
import { ParsedSaveData, SaveData } from './SaveFile';
import { ChainnerSettings } from './settings/settings';
import { Progress } from './ui/progress';

interface ChannelInfo<ReturnType, Args extends unknown[] = []> {
    returnType: ReturnType;
    args: Args;
}
type SendChannelInfo<Args extends unknown[] = []> = ChannelInfo<void, Args>;

export interface InvokeChannels {
    'get-python': ChannelInfo<PythonInfo>;
    'get-backend-url': ChannelInfo<string>;
    'refresh-nodes': ChannelInfo<boolean>;
    'get-app-version': ChannelInfo<Version>;
    'dir-select': ChannelInfo<OpenDialogReturnValue, [dirPath: string]>;
    'file-select': ChannelInfo<
        OpenDialogReturnValue,
        [filters: FileFilter[], allowMultiple: boolean | undefined, dirPath: string | undefined]
    >;

    'file-save-json': ChannelInfo<void, [saveData: SaveData, savePath: string]>;
    'file-save-as-json': ChannelInfo<
        FileSaveResult,
        [saveData: SaveData, defaultPath: string | undefined]
    >;
    'get-auto-open': ChannelInfo<FileOpenResult<ParsedSaveData> | undefined>;
    'owns-backend': ChannelInfo<boolean>;
    'restart-backend': ChannelInfo<void>;
    'relaunch-application': ChannelInfo<void>;
    'quit-application': ChannelInfo<void>;
    'get-appdata': ChannelInfo<string>;
    'open-url': ChannelInfo<void, [url: string]>;

    // settings
    'get-settings': ChannelInfo<ChainnerSettings>;
    'set-settings': ChannelInfo<void, [settings: ChainnerSettings]>;

    // fs
    'fs-read-file': ChannelInfo<
        string,
        // Mostly copied this from the original fs.readFile, but had to remove some bits due to being unable to import the types
        [
            path: PathLike,
            options:
                | {
                      encoding: BufferEncoding;
                      flag?: OpenMode | undefined;
                  }
                | BufferEncoding
        ]
    >;
    'fs-write-file': ChannelInfo<
        void,
        // Mostly copied this from the original fs.writeFile, but had to remove some bits due to being unable to import the types
        [
            file: PathLike,
            data:
                | string
                | NodeJS.ArrayBufferView
                | Iterable<string | NodeJS.ArrayBufferView>
                | AsyncIterable<string | NodeJS.ArrayBufferView>,
            options?:
                | (ObjectEncodingOptions & {
                      mode?: Mode | undefined;
                      flag?: OpenMode | undefined;
                  })
                | BufferEncoding
                | null
        ]
    >;
    'fs-exists': ChannelInfo<boolean, [path: string]>;
    'fs-mkdir': ChannelInfo<string | undefined, [path: string, options: MakeDirectoryOptions]>;
    'fs-readdir': ChannelInfo<string[], [path: string]>;
    'fs-unlink': ChannelInfo<void, [path: string]>;
    'fs-access': ChannelInfo<void, [path: string]>;

    // Electron
    'shell-showItemInFolder': ChannelInfo<void, [fullPath: string]>;
    'shell-openPath': ChannelInfo<string, [fullPath: string]>;
    'app-quit': ChannelInfo<void>;
    'clipboard-writeText': ChannelInfo<void, [text: string]>;
    'clipboard-readText': ChannelInfo<string>;
    'clipboard-writeBuffer': ChannelInfo<
        void,
        [format: string, buffer: Buffer, type?: 'selection' | 'clipboard' | undefined]
    >;
    'clipboard-readBuffer': ChannelInfo<Buffer, [format: string]>;
    'clipboard-availableFormats': ChannelInfo<string[]>;
    'clipboard-readHTML': ChannelInfo<string>;
    'clipboard-readRTF': ChannelInfo<string>;
    'clipboard-readImage': ChannelInfo<Electron.NativeImage>;
    'clipboard-writeImage': ChannelInfo<void, [image: Electron.NativeImage]>;
    'clipboard-writeImageFromURL': ChannelInfo<void, [url: string]>;
}

export interface SendChannels {
    'setup-progress': SendChannelInfo<[progress: Progress]>;
    'backend-started': SendChannelInfo;
    'file-new': SendChannelInfo;
    'file-open': SendChannelInfo<[FileOpenResult<ParsedSaveData>]>;
    'file-save-as': SendChannelInfo;
    'file-save': SendChannelInfo;
    'file-export-template': SendChannelInfo;
    'start-sleep-blocker': SendChannelInfo;
    'stop-sleep-blocker': SendChannelInfo;
    'update-has-unsaved-changes': SendChannelInfo<[boolean]>;
    'update-open-recent-menu': SendChannelInfo<[string[]]>;
    'clear-open-recent': SendChannelInfo;
    'window-maximized-change': SendChannelInfo<[maximized: boolean]>;
    'window-blur': SendChannelInfo;
    'show-collected-information': SendChannelInfo<[info: Record<string, unknown>]>;
    'disable-menu': SendChannelInfo;
    'enable-menu': SendChannelInfo;
    'save-before-exit': SendChannelInfo;
    'exit-after-save': SendChannelInfo;
    'save-before-reboot': SendChannelInfo;
    'reboot-after-save': SendChannelInfo;
    'set-progress-bar': ChannelInfo<void, [progress: number | null]>;
    'export-viewport': SendChannelInfo<[kind: 'file' | 'clipboard']>;

    // history
    'history-undo': SendChannelInfo;
    'history-redo': SendChannelInfo;

    // edit
    cut: SendChannelInfo;
    copy: SendChannelInfo;
    paste: SendChannelInfo;
    duplicate: SendChannelInfo;
    'duplicate-with-input-edges': SendChannelInfo;
    'format-chain': SendChannelInfo;
}
export type ChannelArgs<C extends keyof (InvokeChannels & SendChannels)> = (InvokeChannels &
    SendChannels)[C]['args'];
export type ChannelReturn<C extends keyof (InvokeChannels & SendChannels)> = (InvokeChannels &
    SendChannels)[C]['returnType'];
