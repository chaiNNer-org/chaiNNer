import { useEffect } from 'react';
import { ChannelArgs, SendChannels } from '../../common/safeIpc';
import { ipcRenderer } from '../safeIpc';
// eslint-disable-next-line import/no-nodejs-modules
import type { IpcRendererEvent } from 'electron/renderer';

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
