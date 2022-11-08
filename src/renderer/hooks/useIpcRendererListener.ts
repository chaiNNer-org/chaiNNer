import { IpcRendererEvent } from 'electron';
import { useEffect } from 'react';
import { ChannelArgs, SendChannels, ipcRenderer } from '../../common/safeIpc';

export const useIpcRendererListener = <C extends keyof SendChannels>(
    channel: C,
    listener: (event: IpcRendererEvent, ...args: ChannelArgs<C>) => void
) => {
    useEffect(() => {
        ipcRenderer.on(channel, listener);
        return () => {
            ipcRenderer.removeListener(channel, listener);
        };
    }, [channel, listener]);
};
