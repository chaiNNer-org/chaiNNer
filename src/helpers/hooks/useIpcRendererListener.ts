import { IpcRendererEvent } from 'electron';
import { useEffect } from 'react';
import { ChannelArgs, SendChannels, ipcRenderer } from '../safeIpc';

export const useIpcRendererListener = <C extends keyof SendChannels>(
    channel: C,
    listener: (event: IpcRendererEvent, ...args: ChannelArgs<C>) => void,
    deps: unknown[]
) => {
    useEffect(() => {
        ipcRenderer.on(channel, listener);
        return () => {
            ipcRenderer.removeListener(channel, listener);
        };
    }, deps);
};
