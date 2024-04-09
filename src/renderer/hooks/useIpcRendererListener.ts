import { IpcRendererEvent } from 'electron/renderer';
import { useEffect } from 'react';
import { ChannelArgs, SendChannels } from '../../common/safeIpc';
import { ipcRenderer } from '../safeIpc';

export const useIpcRendererListener = <C extends keyof SendChannels>(
    channel: C,
    listener: (event: IpcRendererEvent, ...args: ChannelArgs<C>) => void
) => {
    useEffect(() => {
        console.log('channel', channel);
        const func = (...args: any[]) => {
            console.log('interception');

            // @ts-expect-error This is fine
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            listener(...args);
        };
        ipcRenderer.on(channel, func);
        return () => {
            ipcRenderer.removeListener(channel, listener);
        };
    }, [channel, listener]);
};
