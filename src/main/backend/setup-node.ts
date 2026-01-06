import portfinder from 'portfinder';
import { log } from '../../common/log';
import { CriticalError } from '../../common/ui/error';
import { NodeBackend } from './node-backend';

const getValidPort = async () => {
    log.info('Attempting to check for a port...');
    const port = await portfinder.getPortPromise();
    if (!port) {
        log.error('An open port could not be found');

        throw new CriticalError({
            title: 'No open port',
            message:
                'This error should never happen, but if it does it means you are running a lot of servers on your computer that just happen to be in the port range I look for. Quit some of those and then this will work.',
        });
    }
    log.info(`Port found: ${port}`);

    return port;
};

export interface SetupNodeBackendResult {
    backend: NodeBackend;
    url: string;
}

export const setupNodeBackend = async (): Promise<SetupNodeBackendResult> => {
    const port = await getValidPort();

    log.info('Starting Node.js backend...');
    const backend = new NodeBackend({ port });

    try {
        await backend.start();
        const url = backend.getUrl();

        log.info(`Node.js backend started successfully at ${url}`);

        return {
            backend,
            url,
        };
    } catch (error) {
        log.error('Failed to start Node.js backend:', error);
        throw new CriticalError({
            title: 'Failed to start backend',
            message: `The Node.js backend failed to start: ${String(error)}`,
        });
    }
};
