/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable import/no-nodejs-modules */
import { Version } from '../common/common-types';
import { ChannelArgs, ChannelReturn, InvokeChannels, SendChannels } from '../common/safeIpc';
import { defaultSettings } from '../common/settings/settings';
import type { IpcRendererEvent } from 'electron/renderer';

/**
 * Mock IPC renderer for web mode (non-Electron).
 * This provides stub implementations for all IPC channels.
 */

// Mock app constants for web mode
export const mockAppConstants = {
    appVersion: '0.0.0-web' as Version,
    isMac: false,
    isArmMac: false,
    appDataPath: '/tmp/chainner-web',
};

// Event listeners storage
const eventListeners = new Map<string, Set<(...args: any[]) => void>>();

// Mock implementations for IPC channels
const mockInvoke = async <C extends keyof InvokeChannels>(
    channel: C,
    ...args: ChannelArgs<C>
): Promise<ChannelReturn<C>> => {
    console.log(`[Mock IPC] invoke: ${channel}`, args);

    switch (channel) {
        case 'get-python':
            return {
                python: '/usr/bin/python3',
                version: '3.11.0',
            } as ChannelReturn<C>;

        case 'get-backend-url':
            // Check if a backend URL is provided via environment variable or default to mock
            return ((window as any).__CHAINNER_BACKEND_URL__ ||
                'http://localhost:8000') as ChannelReturn<C>;

        case 'get-settings':
            // Return default settings from localStorage or defaults
            const savedSettings = localStorage.getItem('chainner-settings');
            if (savedSettings) {
                return JSON.parse(savedSettings) as ChannelReturn<C>;
            }
            return defaultSettings as ChannelReturn<C>;

        case 'set-settings':
            // Save settings to localStorage
            if (args[0]) {
                localStorage.setItem('chainner-settings', JSON.stringify(args[0]));
            }
            return undefined as ChannelReturn<C>;

        case 'owns-backend':
            return false as ChannelReturn<C>;

        case 'get-auto-open':
            return undefined as ChannelReturn<C>;

        case 'refresh-nodes':
            return false as ChannelReturn<C>;

        case 'dir-select':
        case 'file-select':
            // Return canceled for file dialogs in web mode
            return { canceled: true, filePaths: [] } as ChannelReturn<C>;

        case 'file-save-json':
        case 'file-save-as-json':
            console.warn('[Mock IPC] File save operations are not supported in web mode');
            return undefined as ChannelReturn<C>;

        case 'open-save-file':
            return {
                kind: 'Error',
                message: 'Not supported in web mode',
            } as unknown as ChannelReturn<C>;

        case 'restart-backend':
        case 'relaunch-application':
        case 'quit-application':
        case 'open-url':
        case 'app-quit':
            console.warn(`[Mock IPC] ${channel} is not supported in web mode`);
            return undefined as ChannelReturn<C>;

        case 'fs-read-file':
        case 'fs-write-file':
        case 'fs-exists':
        case 'fs-mkdir':
        case 'fs-readdir':
        case 'fs-unlink':
        case 'fs-access':
            console.warn('[Mock IPC] File system operations are not supported in web mode');
            return Promise.reject(new Error('File system not available in web mode'));

        case 'shell-showItemInFolder':
        case 'shell-openPath':
            console.warn('[Mock IPC] Shell operations are not supported in web mode');
            return undefined as ChannelReturn<C>;

        case 'clipboard-writeText':
            if (navigator.clipboard && args[0]) {
                await navigator.clipboard.writeText(args[0] as string);
            }
            return undefined as ChannelReturn<C>;

        case 'clipboard-readText':
            if (navigator.clipboard) {
                return (await navigator.clipboard.readText()) as ChannelReturn<C>;
            }
            return '' as ChannelReturn<C>;

        case 'clipboard-availableFormats':
            return [] as ChannelReturn<C>;

        case 'clipboard-writeBuffer':
        case 'clipboard-writeBuffer-fromString':
        case 'clipboard-readBuffer':
        case 'clipboard-readBuffer-toString':
        case 'clipboard-readHTML':
        case 'clipboard-readRTF':
        case 'clipboard-writeImageFromURL':
            console.warn('[Mock IPC] Advanced clipboard operations are not supported in web mode');
            return undefined as ChannelReturn<C>;

        default:
            console.warn(`[Mock IPC] Unhandled invoke channel: ${channel}`);
            return undefined as ChannelReturn<C>;
    }
};

const mockOn = <C extends keyof SendChannels>(
    channel: C,
    listener: (event: IpcRendererEvent, ...args: ChannelArgs<C>) => void
): void => {
    let channelListeners = eventListeners.get(channel);
    if (!channelListeners) {
        channelListeners = new Set();
        eventListeners.set(channel, channelListeners);
    }
    channelListeners.add(listener as any);
};

const mockOnce = <C extends keyof SendChannels>(
    channel: C,
    listener: (event: IpcRendererEvent, ...args: ChannelArgs<C>) => void
): void => {
    const onceListener = (event: IpcRendererEvent, ...args: ChannelArgs<C>) => {
        listener(event, ...args);
        mockRemoveListener(channel, onceListener as any);
    };
    mockOn(channel, onceListener);
};

const mockRemoveListener = <C extends keyof SendChannels>(
    channel: C,
    listener: (...args: any[]) => void
): void => {
    const channelListeners = eventListeners.get(channel);
    if (channelListeners) {
        channelListeners.delete(listener);
    }
};

const mockRemoveAllListeners = (channel: string): void => {
    eventListeners.delete(channel);
};

export const mockIpcRenderer = {
    invoke: mockInvoke,
    on: mockOn,
    once: mockOnce,
    postMessage: () => {},
    removeAllListeners: mockRemoveAllListeners,
    removeListener: mockRemoveListener,
    send: () => {},
    sendSync: () => {},
    sendTo: () => {},
    sendToHost: () => {},
};
