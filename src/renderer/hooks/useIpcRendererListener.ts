import { IpcRendererEvent } from 'electron/renderer';
import { useEffect } from 'react';
import { ChannelArgs, SendChannels } from '../../common/safeIpc';
import { ipcRenderer } from '../safeIpc';

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
